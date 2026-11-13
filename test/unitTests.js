import fs from 'node:fs'
import assert from 'node:assert/strict'
import { isPreloadable, status, getMetrics, setConfig, resetConfig } from '../flashpage.js'
import { parseRetryAfter } from '../src/engines.js'
import { recordTransition } from '../src/markov.js'
import { parseDatasetConfig } from '../src/config.js'
import { findAnchorFromEvent } from '../src/input.js'
import { collectAnchors } from '../src/viewport.js'
import { getEffectiveConcurrency, getPriorityWeight, enqueuePrefetch, resetQueue, getQueueStatus } from '../src/queue.js'
import { dispatchExporters } from '../src/telemetry.js'
import { isolateHeatmaps } from '../src/guards.js'
import { extractExternalOrigins, preconnectOrigins, resetSubresources } from '../src/subresources.js'
import { useFlashPage, useFlash, flashAction, setupAstroTransitions, createFlashLink } from '../src/framework-utils.js'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

globalThis.location = new URL('https://example.com/blog/article-1')

function setMockNavigator(navObj = {}) {
    try { delete globalThis.navigator } catch {}
    try {
        Object.defineProperty(globalThis, 'navigator', {
            value: navObj,
            configurable: true,
            writable: true,
            enumerable: true
        })
    } catch {
        try {
            globalThis.navigator = navObj
        } catch {
            if (globalThis.navigator) Object.assign(globalThis.navigator, navObj)
        }
    }
}
setMockNavigator({ connection: null, deviceMemory: 4 })

console.log(`Running Flash Page v${pkg.version} Unit Tests...`)

// Test: Null & Invalid Elements
assert.equal(isPreloadable(null), false, 'Should reject null')
assert.equal(isPreloadable({}), false, 'Should reject empty object')
assert.equal(isPreloadable({ href: '' }), false, 'Should reject empty href')

// Test: Standard Same-Origin Link
const validAnchor = {
    href: 'https://example.com/blog/article-2',
    origin: 'https://example.com',
    protocol: 'https:',
    pathname: '/blog/article-2',
    search: '',
    hash: '',
    dataset: {},
    hasAttribute: () => false,
    relList: { contains: () => false }
}
assert.equal(isPreloadable(validAnchor), true, 'Should accept valid anchor')

// Test: Download Attribute Filter
const downloadAnchor = {
    ...validAnchor,
    hasAttribute: (attr) => attr === 'download'
}
assert.equal(isPreloadable(downloadAnchor), false, 'Should reject download anchor')

// Test: rel="nofollow" Filter
const nofollowAnchor = {
    ...validAnchor,
    relList: { contains: (rel) => rel === 'nofollow' }
}
assert.equal(isPreloadable(nofollowAnchor), false, 'Should reject nofollow anchor')

// Test: data-no-flash Filter
const noFlashAnchor = {
    ...validAnchor,
    dataset: { noFlash: '' }
}
assert.equal(isPreloadable(noFlashAnchor), false, 'Should reject data-no-flash')

// Test: Action methods (data-method="post", hx-post)
const actionAnchor = {
    ...validAnchor,
    hasAttribute: (attr) => attr === 'data-method' || attr === 'hx-post'
}
assert.equal(isPreloadable(actionAnchor), false, 'Should reject action links')

// Test: Sensitive URL Endpoints
const logoutAnchor = {
    ...validAnchor,
    href: 'https://example.com/user/logout',
    pathname: '/user/logout'
}
assert.equal(isPreloadable(logoutAnchor), false, 'Should reject logout path')

// Test: Same-page Hash Links
const samePageHash = {
    ...validAnchor,
    href: 'https://example.com/blog/article-1#comments',
    pathname: '/blog/article-1',
    hash: '#comments'
}
assert.equal(isPreloadable(samePageHash), false, 'Should reject same page hash link')

// Test: External Origin Links (disallowed by default)
const externalAnchor = {
    ...validAnchor,
    href: 'https://other-domain.com/page',
    origin: 'https://other-domain.com'
}
assert.equal(isPreloadable(externalAnchor), false, 'Should reject external links by default')

// Test: Whitelisted External Link
const externalWhitelisted = {
    ...externalAnchor,
    dataset: { flash: '' }
}
assert.equal(isPreloadable(externalWhitelisted), true, 'Should allow external links with data-flash')

// Test: Status and Metrics APIs
assert.equal(typeof status, 'function', 'status() should be a function')
assert.equal(typeof getMetrics, 'function', 'getMetrics() should be a function')

// Test: parseRetryAfter
assert.equal(parseRetryAfter(null), 30, 'parseRetryAfter null fallback')
assert.equal(parseRetryAfter(''), 30, 'parseRetryAfter empty string fallback')
assert.equal(parseRetryAfter('120'), 120, 'parseRetryAfter numeric seconds')
assert.equal(parseRetryAfter('0'), 0, 'parseRetryAfter zero')
assert.equal(parseRetryAfter('999999'), 300, 'parseRetryAfter capped at 300s')
const futureDate = new Date(Date.now() + 45000).toUTCString()
const parsedFuture = parseRetryAfter(futureDate)
assert.ok(parsedFuture >= 40 && parsedFuture <= 50, 'parseRetryAfter HTTP-date string')

// Test: Segment-based Sensitive Path Filtering
const allowedRemoveWord = {
    ...validAnchor,
    href: 'https://example.com/blog/how-to-remove-stains',
    pathname: '/blog/how-to-remove-stains'
}
assert.equal(isPreloadable(allowedRemoveWord), true, 'Should allow /blog/how-to-remove-stains')

const sensitivePath = {
    ...validAnchor,
    href: 'https://example.com/api/remove',
    pathname: '/api/remove'
}
assert.equal(isPreloadable(sensitivePath), false, 'Should reject /api/remove')

const logoutPath = {
    ...validAnchor,
    href: 'https://example.com/logout',
    pathname: '/logout'
}
assert.equal(isPreloadable(logoutPath), false, 'Should reject /logout')

// Test: Markov transition matrix hard cap (max 50 paths) and destination pruning (max 5)
const mockStorage = {}
globalThis.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v }
}

// 1. Destination pruning: weakest existing destination evicted, new destination survives
for (let d = 1; d <= 5; d++) {
    for (let c = 0; c < d; c++) {
        recordTransition('/popular-source', `/dest-${d}`)
    }
}
// Visit /dest-6 10 times
for (let i = 0; i < 10; i++) {
    recordTransition('/popular-source', '/dest-6')
}
let storedMatrix = JSON.parse(mockStorage['flash_markov'])
const popularDests = Object.keys(storedMatrix['/popular-source'])
assert.equal(popularDests.length, 5, 'Should cap destinations to top 5')
assert.ok(popularDests.includes('/dest-6'), 'New destination should survive and be retained')
assert.equal(storedMatrix['/popular-source']['/dest-6'], 10, 'New destination should accumulate counts')
assert.ok(!popularDests.includes('/dest-1'), 'Weakest existing destination (/dest-1 with count 1) should be evicted')

// 2. 50 source paths cap and LRU recency survival
for (let i = 0; i < 55; i++) {
    recordTransition(`/source-${i}`, `/dest-default`)
    if (i === 30) {
        // Access popular-source again so its recency updates
        recordTransition('/popular-source', '/dest-1')
    }
}
storedMatrix = JSON.parse(mockStorage['flash_markov'])
assert.ok(Object.keys(storedMatrix).length <= 50, 'Markov matrix should never exceed 50 paths')
assert.ok(storedMatrix['/popular-source'], 'Recently refreshed source path should survive eviction (LRU)')
assert.ok(!storedMatrix['/source-0'], 'Oldest untouched path should be evicted')

// Test: CSP Nonce Dataset Parsing
const datasetWithNonce = { flashNonce: 'abc-nonce-xyz-123' }
const parsedNonceConfig = parseDatasetConfig(datasetWithNonce)
assert.equal(parsedNonceConfig.nonce, 'abc-nonce-xyz-123', 'Should parse flashNonce correctly')

// Test: Destructive Query Actions
setConfig({ allowQueryString: true })
const deleteQueryAnchor = {
    ...validAnchor,
    href: 'https://example.com/items?action=delete&id=42',
    search: '?action=delete&id=42'
}
assert.equal(isPreloadable(deleteQueryAnchor), false, 'Should reject ?action=delete even when query string enabled')

const logoutQueryAnchor = {
    ...validAnchor,
    href: 'https://example.com/auth?do=logout',
    search: '?do=logout'
}
assert.equal(isPreloadable(logoutQueryAnchor), false, 'Should reject ?do=logout even when query string enabled')

const safeQueryAnchor = {
    ...validAnchor,
    href: 'https://example.com/items?action=view&id=42',
    search: '?action=view&id=42'
}
assert.equal(isPreloadable(safeQueryAnchor), true, 'Should allow non-destructive query actions when query string enabled')
resetConfig()

// Test: Shadow DOM Composed Path Event Retargeting
const innerSpan = { tagName: 'SPAN', nodeType: 1 }
const shadowAnchor = { tagName: 'A', nodeType: 1, href: 'https://example.com/article-shadow', hasAttribute: () => false, relList: { contains: () => false }, dataset: {} }
const customCard = { tagName: 'CUSTOM-CARD', nodeType: 1 }

const simulatedShadowEvent = {
    target: customCard,
    composedPath: () => [innerSpan, shadowAnchor, customCard]
}
assert.equal(findAnchorFromEvent(simulatedShadowEvent), shadowAnchor, 'Should resolve <a> across shadow DOM boundary using composedPath()')

// Test: collectAnchors with Open Shadow Roots
const mockAnchorLight = { tagName: 'A', href: '/light-link' }
const mockAnchorShadow = { tagName: 'A', href: '/shadow-link' }
const mockRoot = {
    querySelectorAll: (selector) => {
        if (selector === 'a') return [mockAnchorLight]
        if (selector === '*') return [{
            shadowRoot: {
                querySelectorAll: (s) => (s === 'a' ? [mockAnchorShadow] : [])
            }
        }]
        return []
    }
}
const collected = collectAnchors(mockRoot)
assert.equal(collected.length, 2, 'Should collect both light DOM and open shadow DOM anchors')
assert.ok(collected.includes(mockAnchorLight), 'Should include light DOM anchor')
assert.ok(collected.includes(mockAnchorShadow), 'Should include shadow DOM anchor')

// Test: getEffectiveConcurrency Network Adaptation
const origNav = globalThis.navigator
try {
    // 1. Adaptive disabled: always returns maxConcurrent
    assert.equal(getEffectiveConcurrency({ adaptiveConcurrency: false, maxConcurrent: 3 }), 3)

    // 2. Adaptive enabled on fast connection (downlink >= 10)
    setMockNavigator({ connection: { downlink: 15, rtt: 30 } })
    assert.equal(getEffectiveConcurrency({ adaptiveConcurrency: true, maxConcurrent: 3 }), 6, 'Should scale concurrency up to 6 on fast connection')

    // 3. Adaptive enabled on slow connection (downlink < 1.5 or rtt > 250)
    setMockNavigator({ connection: { downlink: 0.8, rtt: 300 } })
    assert.equal(getEffectiveConcurrency({ adaptiveConcurrency: true, maxConcurrent: 3 }), 1, 'Should scale concurrency down to 1 on slow connection')

    // 4. Adaptive enabled on moderate connection
    setMockNavigator({ connection: { downlink: 5, rtt: 80 } })
    assert.equal(getEffectiveConcurrency({ adaptiveConcurrency: true, maxConcurrent: 3 }), 3, 'Should keep maxConcurrent on moderate connection')
} finally {
    setMockNavigator(origNav)
}

// Test: dispatchExporters (Beacon, GA4, Datadog, Sentry, Callback)
const sampleMetric = {
    url: 'https://example.com/test',
    converted: true,
    wasPrerendered: true,
    lcpSavedMs: 280,
    transferSize: 4500,
    duration: 35
}

// 1. Custom callback
let callbackReceived = null
dispatchExporters(sampleMetric, { analytics: (m) => { callbackReceived = m } })
assert.equal(callbackReceived, sampleMetric, 'Custom analytics callback should receive metric')

// 2. GA4 exporter
let ga4Event = null
globalThis.window = globalThis.window || {}
globalThis.window.gtag = (type, name, params) => {
    ga4Event = { type, name, params }
}
dispatchExporters(sampleMetric, { analytics: 'ga4' })
assert.equal(ga4Event.name, 'flash_navigation', 'GA4 event name should be flash_navigation')
assert.equal(ga4Event.params.was_prerendered, true, 'GA4 event should contain was_prerendered')
assert.equal(ga4Event.params.lcp_saved_ms, 280, 'GA4 event should contain lcp_saved_ms')

// 3. Datadog exporter
let ddAction = null
globalThis.window.DD_RUM = {
    addAction: (name, data) => { ddAction = { name, data } }
}
dispatchExporters(sampleMetric, { analytics: 'datadog' })
assert.equal(ddAction.name, 'flash_navigation', 'Datadog action should be flash_navigation')
assert.equal(ddAction.data.url, 'https://example.com/test', 'Datadog data should contain metric')

// 4. Sentry exporter
let sentryBreadcrumb = null
globalThis.window.Sentry = {
    addBreadcrumb: (b) => { sentryBreadcrumb = b }
}
dispatchExporters(sampleMetric, { analytics: 'sentry' })
assert.equal(sentryBreadcrumb.category, 'flash.navigation', 'Sentry category should be flash.navigation')

// 5. Beacon API
let beaconDispatched = null
setMockNavigator({
    sendBeacon: (url, body) => { beaconDispatched = { url, body } }
})
dispatchExporters(sampleMetric, { beaconUrl: 'https://example.com/collect' })
assert.equal(beaconDispatched.url, 'https://example.com/collect')
assert.ok(beaconDispatched.body.includes('"wasPrerendered":true'))

// Test: isolateHeatmaps
let hjPaused = false, hjResumed = false
let clarityPaused = false, clarityResumed = false
let fsShutdown = false, fsRestarted = false

globalThis.window.hj = {
    pause: () => { hjPaused = true },
    resume: () => { hjResumed = true }
}
globalThis.window.clarity = {
    pause: () => { clarityPaused = true },
    resume: () => { clarityResumed = true }
}
globalThis.window.FS = {
    shutdown: () => { fsShutdown = true },
    restart: () => { fsRestarted = true }
}

const eventListeners = {}
globalThis.document = {
    prerendering: true,
    head: { appendChild: () => {} },
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        setAttribute: () => {},
        getAttribute: () => null,
        style: {},
        relList: { supports: () => true, contains: () => false },
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: (type, fn) => {
        eventListeners[type] = fn
    },
    removeEventListener: (type) => {
        delete eventListeners[type]
    }
}

setConfig({ isolateHeatmaps: true })
isolateHeatmaps()
assert.equal(hjPaused, true, 'Hotjar should be paused on prerendering')
assert.equal(clarityPaused, true, 'Clarity should be paused on prerendering')
assert.equal(fsShutdown, true, 'FullStory should be shut down on prerendering')

// Simulate prerendering activation
if (eventListeners['prerenderingchange']) {
    eventListeners['prerenderingchange']()
}
assert.equal(hjResumed, true, 'Hotjar should resume on prerenderingchange')
assert.equal(clarityResumed, true, 'Clarity should resume on prerenderingchange')
assert.equal(fsRestarted, true, 'FullStory should restart on prerenderingchange')
resetConfig()

// Test: Priority Queue Scheduling
assert.equal(getPriorityWeight('high'), 3)
assert.equal(getPriorityWeight('auto'), 2)
assert.equal(getPriorityWeight('low'), 1)
assert.equal(getPriorityWeight(undefined), 2)

resetQueue()
setConfig({ priorityQueue: true })
// Enqueue low priority items first
enqueuePrefetch('https://example.com/low-1', 'low')
enqueuePrefetch('https://example.com/low-2', 'low')
// Enqueue high priority item
enqueuePrefetch('https://example.com/high-1', 'high')
// Enqueue auto priority item
enqueuePrefetch('https://example.com/auto-1', 'auto')

const queueItems = getQueueStatus().queue
// When concurrency is not executing mock, verify queue ordering
assert.ok(queueItems.length > 0)
// High priority items should precede low priority items in queue
const highIdx = queueItems.findIndex(q => q.priority === 'high')
const lowIdx = queueItems.findIndex(q => q.priority === 'low')
if (highIdx !== -1 && lowIdx !== -1) {
    assert.ok(highIdx < lowIdx, 'High priority item must be ahead of low priority item in queue')
}
resetQueue()
resetConfig()

// Test: E-Commerce Cart & Checkout Safeguards
setConfig({ cartSafeguards: true })
const testAnchorBase = {
    hasAttribute: () => false,
    relList: { contains: () => false },
    dataset: {}
}

const cartUrls = [
    'https://example.com/cart',
    'https://example.com/cart/',
    'https://example.com/checkout',
    'https://example.com/shop/checkout/review',
    'https://example.com/basket',
    'https://example.com/my-account',
    'https://example.com/shop?add-to-cart=123',
    'https://example.com/api?wc-ajax=get_refreshed_fragments',
    'https://example.com/cart?empty-cart=yes'
]

for (const cartUrl of cartUrls) {
    const a = { ...testAnchorBase, href: cartUrl }
    assert.equal(isPreloadable(a), false, `Cart/checkout link must be rejected: ${cartUrl}`)
}

// When cartSafeguards is disabled, standard non-destructive cart URLs pass
setConfig({ cartSafeguards: false })
const standardCart = { ...testAnchorBase, href: 'https://example.com/cart' }
assert.equal(isPreloadable(standardCart), true, 'Cart URL should be allowed when cartSafeguards is false')
resetConfig()

// Test: Subresource Preconnect 2.0 & External Origins
const htmlWithCdn = `
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto">
    <link rel="preload" as="font" href="https://fonts.gstatic.com/s/roboto/font.woff2">
    <link rel="stylesheet" href="/local.css">
</head>
</html>
`
const externalOrigins = extractExternalOrigins(htmlWithCdn)
assert.ok(externalOrigins.includes('https://fonts.googleapis.com'), 'Should extract Google Fonts CSS origin')
assert.ok(externalOrigins.includes('https://fonts.gstatic.com'), 'Should extract Google Fonts static font origin')
assert.equal(externalOrigins.length, 2, 'Should only contain the 2 external origins')

// Test: Framework Ecosystem Adapters
// 1. React createFlashLink
const mockReact = {
    createElement: (tag, props, children) => ({ tag, props, children }),
    forwardRef: (fn) => fn
}
const LinkComponent = createFlashLink(mockReact)
assert.equal(typeof LinkComponent, 'function', 'createFlashLink must return a component function')
const rendered = LinkComponent({ href: '/docs', priority: 'high', children: 'Docs' })
assert.equal(rendered.tag, 'a')
assert.equal(rendered.props.href, '/docs')

// 2. Svelte flashAction
let svelteListeners = {}
const mockNode = {
    addEventListener: (type, fn) => { svelteListeners[type] = fn },
    removeEventListener: (type) => { delete svelteListeners[type] },
    getAttribute: () => '/svelte-page'
}
const actionInstance = flashAction(mockNode, { priority: 'high' })
assert.ok(typeof svelteListeners['pointerover'] === 'function')
assert.ok(typeof svelteListeners['pointerdown'] === 'function')
actionInstance.destroy()
assert.equal(svelteListeners['pointerover'], undefined)
assert.equal(svelteListeners['pointerdown'], undefined)

// 3. Astro setupAstroTransitions
let astroListeners = {}
globalThis.document = globalThis.document || {}
globalThis.document.addEventListener = (type, fn) => { astroListeners[type] = fn }
globalThis.document.removeEventListener = (type) => { delete astroListeners[type] }

const astroCleanup = setupAstroTransitions()
assert.ok(typeof astroListeners['astro:page-load'] === 'function')
astroCleanup()
assert.equal(astroListeners['astro:page-load'], undefined)

console.log(`✅ All Flash Page v${pkg.version} Unit Tests Passed!`)
