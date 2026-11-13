import assert from 'node:assert/strict'
import { isPreloadable } from '../src/guards.js'
import { setConfig, resetConfig, setBackpressure, isServerHealthy, getBackpressureUntil } from '../src/config.js'
import { setupDocumentSpeculationRules, preloadUsingSpeculationList } from '../src/engines.js'
import { recordTransition } from '../src/markov.js'

console.log('🛡️ Starting Flash Page Security, Vulnerability & Edge Case Audit Suite...')

// Simulated browser environment
globalThis.location = new URL('https://secure-bank.example.com/dashboard/home')

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

const baseAnchor = {
    href: 'https://secure-bank.example.com/dashboard/transfers',
    origin: 'https://secure-bank.example.com',
    protocol: 'https:',
    pathname: '/dashboard/transfers',
    search: '',
    hash: '',
    dataset: {},
    hasAttribute: () => false,
    relList: { contains: () => false }
}

// ==========================================
// 1. PROTOCOL INJECTION & SCHEME RESTRICTIONS
// ==========================================
console.log('  1. Verifying protocol injection & dangerous URI schemes...')

const dangerousSchemes = [
    'javascript:alert(document.cookie)',
    'javascript://%0aalert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    'blob:https://secure-bank.example.com/uuid-blob-1234',
    'chrome://settings',
    'ws://secure-bank.example.com/socket',
    'wss://secure-bank.example.com/socket',
]

for (const badScheme of dangerousSchemes) {
    const badAnchor = { ...baseAnchor, href: badScheme }
    assert.equal(isPreloadable(badAnchor), false, `Dangerous scheme must be rejected: ${badScheme}`)
}

// Test HTTP Downgrade attack on HTTPS site
const downgradeAnchor = {
    ...baseAnchor,
    href: 'http://secure-bank.example.com/insecure-page',
    protocol: 'http:'
}
assert.equal(isPreloadable(downgradeAnchor), false, 'HTTP downgrade on HTTPS origin must be strictly rejected')

console.log('    ✓ All dangerous schemes and downgrade attacks rejected')

// ==========================================
// 2. CROSS-ORIGIN LEAKAGE PREVENTION
// ==========================================
console.log('  2. Verifying cross-origin boundary enforcement...')

setConfig({ allowExternalLinks: false })
const externalAnchor = {
    ...baseAnchor,
    href: 'https://evil-phishing.example.org/login',
    origin: 'https://evil-phishing.example.org',
    pathname: '/login'
}
assert.equal(isPreloadable(externalAnchor), false, 'Cross-origin link must be rejected when allowExternalLinks is false')
console.log('    ✓ Cross-origin boundaries strictly enforced')

// ==========================================
// 3. SENSITIVE ENDPOINTS & DESTRUCTIVE ACTIONS
// ==========================================
console.log('  3. Verifying destructive action & sensitive endpoint filters...')

const sensitiveEndpoints = [
    '/logout',
    '/signout',
    '/delete',
    '/destroy',
    '/remove',
    '/api/v1/logout',
    '/user/account/delete',
    '/auth/signout.php',
    '/dashboard/destroy.json',
    '/LOGOUT',
    '/Delete/All',
    '/log%6Fut',
    '/%64elete',
]

for (const endpoint of sensitiveEndpoints) {
    const anchor = {
        ...baseAnchor,
        href: `https://secure-bank.example.com${endpoint}`,
        pathname: endpoint
    }
    assert.equal(isPreloadable(anchor), false, `Sensitive path must be filtered: ${endpoint}`)
}

// Verify harmless paths are NOT accidentally filtered (no false positives)
const innocentPaths = [
    '/blog/how-to-remove-stains',
    '/articles/delete-key-history',
    '/docs/signout-flow-architecture',
    '/features/instant-delete-recovery',
]

for (const innocent of innocentPaths) {
    const anchor = {
        ...baseAnchor,
        href: `https://secure-bank.example.com${innocent}`,
        pathname: innocent
    }
    assert.equal(isPreloadable(anchor), true, `Innocent path must not be filtered: ${innocent}`)
}

// Destructive Query Parameter Tests
setConfig({ allowQueryString: true })
const destructiveQueries = [
    '?action=delete',
    '?action=logout',
    '?action=destroy',
    '?action=remove',
    '?do=delete',
    '?do=logout',
    '?act=signout',
    '?act=delete',
    '?op=delete',
    '?op=remove',
    '?ACTION=DELETE',
    '?id=42&action=delete&confirm=yes',
    '?user=bob&do=logout&redirect=home',
    '?action=%64elete',
    '?do=%6c%6f%67%6f%75%74',
]

for (const query of destructiveQueries) {
    const anchor = {
        ...baseAnchor,
        href: `https://secure-bank.example.com/items${query}`,
        pathname: '/items',
        search: query
    }
    assert.equal(isPreloadable(anchor), false, `Destructive query must be filtered: ${query}`)
}

// Non-destructive queries must still pass when allowQueryString is enabled
const safeQueries = [
    '?action=view',
    '?action=edit',
    '?do=search',
    '?page=2&sort=asc',
    '?q=flash-page',
]

for (const query of safeQueries) {
    const anchor = {
        ...baseAnchor,
        href: `https://secure-bank.example.com/items${query}`,
        pathname: '/items',
        search: query
    }
    assert.equal(isPreloadable(anchor), true, `Safe query must be allowed: ${query}`)
}
resetConfig()
console.log('    ✓ Destructive paths, queries, and percent-encoded variations filtered without false positives')

// ==========================================
// 4. XSS & SPECULATION RULES INLINE BREAKOUT
// ==========================================
console.log('  4. Verifying inline script escaping & CSP Nonce sanitization...')

// Mock document for speculation injection tests
const elementsCreated = []
const headChildren = []
globalThis.document = {
    createElement: (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            type: '',
            nonce: '',
            textContent: '',
            attributes: {},
            setAttribute: (k, v) => { el.attributes[k] = v },
            getAttribute: (k) => el.attributes[k]
        }
        elementsCreated.push(el)
        return el
    },
    head: {
        appendChild: (child) => { headChildren.push(child) }
    },
    documentElement: {
        appendChild: (child) => { headChildren.push(child) }
    }
}

// Test: Nonce sanitization
setConfig({ nonce: 'valid-nonce-abc-123' })
setupDocumentSpeculationRules()
const lastDocRule = elementsCreated[elementsCreated.length - 1]
assert.equal(lastDocRule.nonce, 'valid-nonce-abc-123', 'Valid nonce should be applied')
assert.equal(lastDocRule.attributes['nonce'], 'valid-nonce-abc-123', 'Valid nonce attribute should match')

// Test: Malicious Nonce attempt with quotes and tags
setConfig({ nonce: 'evil" onfocus="alert(1)" <script>hack</script>' })
setupDocumentSpeculationRules()
const sanitizedDocRule = elementsCreated[elementsCreated.length - 1]
assert.ok(!sanitizedDocRule.nonce.includes('"'), 'Nonce must not contain quotes')
assert.ok(!sanitizedDocRule.nonce.includes('<'), 'Nonce must not contain <')
assert.ok(!sanitizedDocRule.nonce.includes('>'), 'Nonce must not contain >')
assert.equal(sanitizedDocRule.nonce, 'evil onfocus=alert(1) scripthack/script', 'Nonce should be safely stripped of attribute breakout characters')

// Test: Script breakout via URL in Speculation List
const exploitUrl = 'https://example.com/exploit</script><script>alert("pwned")</script>'
preloadUsingSpeculationList(exploitUrl, 'prefetch')
const lastListRule = elementsCreated[elementsCreated.length - 1]
assert.ok(!lastListRule.textContent.includes('</script>'), 'Script tag breakout must be prevented in JSON textContent')
assert.ok(lastListRule.textContent.includes('<\\/script>'), 'Script tag breakout must be safely escaped as <\\/script>')

console.log('    ✓ Nonce sanitized and inline script breakout escaped')

// ==========================================
// 5. SERVER BACKPRESSURE DOS PROTECTION
// ==========================================
console.log('  5. Verifying server backpressure safety bounds & DoS guards...')

// Attempt to set absurdly high backpressure duration (DoS attempt)
setBackpressure(999999999)
const maxWaitUntil = Date.now() + 301 * 1000
assert.ok(getBackpressureUntil() <= maxWaitUntil, 'Backpressure duration must be safely capped at 300s (5 minutes)')
assert.equal(isServerHealthy(), false, 'Server must report unhealthy during backpressure')
assert.equal(isPreloadable(baseAnchor), false, 'isPreloadable must return false during active backpressure')

// Negative backpressure duration handling
setBackpressure(-500)
assert.equal(isServerHealthy(), true, 'Negative backpressure must resolve immediately')
assert.equal(isPreloadable(baseAnchor), true, 'isPreloadable should permit valid anchor when healthy')

// Non-numeric backpressure handling
setBackpressure('invalid-string')
assert.equal(isServerHealthy(), false, 'Non-numeric string should safely fallback to 30s default')

resetConfig()
console.log('    ✓ Backpressure bounded to 300s safety cap and handles edge cases cleanly')

// ==========================================
// 6. PROTOTYPE POLLUTION RESISTANCE
// ==========================================
console.log('  6. Verifying prototype pollution resistance...')

const maliciousPayload = JSON.parse('{"__proto__": {"pollutedKey": "compromised"}}')
setConfig(maliciousPayload)
assert.equal(({}).pollutedKey, undefined, 'Object.prototype must not be polluted by setConfig')

resetConfig()
console.log('    ✓ Prototype pollution prevented')

// ==========================================
// 7. REGULAR EXPRESSION DENIAL OF SERVICE (ReDoS)
// ==========================================
console.log('  7. Verifying ReDoS immunity under massive string attacks...')

const massivePath = '/segment'.repeat(2500) + '/delete'
const startTimePath = performance.now()
const attackAnchorPath = {
    ...baseAnchor,
    href: `https://secure-bank.example.com${massivePath}`,
    pathname: massivePath
}
isPreloadable(attackAnchorPath)
const durationPath = performance.now() - startTimePath
assert.ok(durationPath < 20, `ReDoS path check took ${durationPath.toFixed(2)}ms, must be < 20ms`)

const massiveQuery = '?' + 'a=1&'.repeat(2500) + 'action=delete'
const startTimeQuery = performance.now()
const attackAnchorQuery = {
    ...baseAnchor,
    href: `https://secure-bank.example.com/items${massiveQuery}`,
    pathname: '/items',
    search: massiveQuery
}
isPreloadable(attackAnchorQuery)
const durationQuery = performance.now() - startTimeQuery
assert.ok(durationQuery < 20, `ReDoS query check took ${durationQuery.toFixed(2)}ms, must be < 20ms`)

console.log(`    ✓ ReDoS checks completed instantaneously (${durationPath.toFixed(2)}ms / ${durationQuery.toFixed(2)}ms)`)

// ==========================================
// 8. MARKOV MODEL BOUNDS & LOCALSTORAGE SAFETY
// ==========================================
console.log('  8. Verifying Markov transition matrix memory safety under stress...')

const mockStorage = {}
globalThis.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v) }
}

// Stress test: 5,000 transitions across 100 paths
for (let p = 0; p < 100; p++) {
    for (let d = 0; d < 8; d++) {
        recordTransition(`/source-${p}`, `/dest-${d}`)
    }
}

const finalMatrix = JSON.parse(mockStorage['flash_markov'])
const totalPaths = Object.keys(finalMatrix).length
assert.ok(totalPaths <= 50, `Markov model paths (${totalPaths}) must never exceed 50`)

for (const [src, dests] of Object.entries(finalMatrix)) {
    const destCount = Object.keys(dests).length
    assert.ok(destCount <= 5, `Destinations for ${src} (${destCount}) must never exceed 5`)
}

console.log('    ✓ Markov model stays strictly within 50-path and 5-destination memory bounds')

// ==========================================
// 9. TELEMETRY BEACON URL PROTOCOL SAFETY
// ==========================================
console.log('  9. Verifying beaconUrl protocol safety and injection rejection...')

import { dispatchExporters } from '../src/telemetry.js'

let beaconPayload = null
let beaconTargetUrl = null
setMockNavigator({
    sendBeacon: (url, data) => {
        beaconTargetUrl = url
        beaconPayload = data
        return true
    }
})

const testMetric = { url: 'https://secure-bank.example.com/page', converted: true, lcpSavedMs: 300 }

// Dangerous protocols should NOT be dispatched by sendBeacon
const dangerousBeacons = [
    'javascript:alert(1)',
    'data:text/plain,malicious',
    'file:///etc/passwd',
    'blob:https://secure-bank.example.com/abc'
]

for (const badBeacon of dangerousBeacons) {
    beaconTargetUrl = null
    dispatchExporters(testMetric, { beaconUrl: badBeacon })
    assert.equal(beaconTargetUrl, null, `Dangerous beacon URL protocol must be blocked: ${badBeacon}`)
}

// Valid HTTP/HTTPS beacon
beaconTargetUrl = null
dispatchExporters(testMetric, { beaconUrl: 'https://secure-bank.example.com/api/telemetry' })
assert.equal(beaconTargetUrl, 'https://secure-bank.example.com/api/telemetry', 'Valid HTTPS beacon must be dispatched')
assert.ok(beaconPayload.includes('"lcpSavedMs":300'), 'Beacon payload must serialize metric object')

console.log('    ✓ Beacon URL protocol safety strictly verified')

// ==========================================
// 10. TELEMETRY EXPORTER FAULT TOLERANCE & EXCEPTION ISOLATION
// ==========================================
console.log('  10. Verifying exporter exception isolation (third-party SDK crashes)...')

globalThis.window = globalThis.window || {}

// Crash-prone GA4
globalThis.window.gtag = () => { throw new Error('Simulated GA4 fatal error') }
assert.doesNotThrow(() => {
    dispatchExporters(testMetric, { analytics: 'ga4' })
}, 'GA4 throwing must be caught gracefully without breaking runtime')

// Crash-prone Datadog RUM
globalThis.window.DD_RUM = {
    addAction: () => { throw new Error('Simulated Datadog fatal error') }
}
assert.doesNotThrow(() => {
    dispatchExporters(testMetric, { analytics: 'datadog' })
}, 'Datadog throwing must be caught gracefully without breaking runtime')

// Crash-prone Sentry
globalThis.window.Sentry = {
    addBreadcrumb: () => { throw new Error('Simulated Sentry fatal error') }
}
assert.doesNotThrow(() => {
    dispatchExporters(testMetric, { analytics: 'sentry' })
}, 'Sentry throwing must be caught gracefully without breaking runtime')

// Crash-prone custom function
assert.doesNotThrow(() => {
    dispatchExporters(testMetric, {
        analytics: () => { throw new Error('Custom callback exception') }
    })
}, 'Custom analytics function throwing must be caught gracefully')

// Null and undefined metric safety
assert.doesNotThrow(() => {
    dispatchExporters(null, { analytics: 'ga4' })
    dispatchExporters(undefined, { beaconUrl: 'https://example.com' })
}, 'Null or undefined metric must be handled safely')

console.log('    ✓ All telemetry exporters isolate and neutralize third-party exceptions')

// ==========================================
// 11. HEATMAP ISOLATION THIRD-PARTY CRASH IMMUNITY
// ==========================================
console.log('  11. Verifying heatmap isolation resilience against buggy third-party SDKs...')

import { isolateHeatmaps } from '../src/guards.js'

globalThis.window.hj = {
    pause: () => { throw new Error('Buggy Hotjar pause') },
    resume: () => { throw new Error('Buggy Hotjar resume') }
}
globalThis.window.clarity = {
    pause: () => { throw new Error('Buggy Clarity pause') },
    resume: () => { throw new Error('Buggy Clarity resume') }
}
globalThis.window.FS = {
    shutdown: () => { throw new Error('Buggy FullStory shutdown') },
    restart: () => { throw new Error('Buggy FullStory restart') }
}

globalThis.document = {
    prerendering: true,
    addEventListener: (event, cb) => {
        // Immediately invoke callback to test resume error isolation
        try { cb() } catch (err) { throw err }
    }
}

setConfig({ isolateHeatmaps: true })
assert.doesNotThrow(() => {
    isolateHeatmaps()
}, 'isolateHeatmaps must gracefully swallow third-party heatmap SDK exceptions')

resetConfig()
console.log('    ✓ Heatmap isolation maintains 100% crash immunity against faulty vendor scripts')

// ==========================================
// 12. NETWORK INFORMATION API EXTREME / MALFORMED VALUES IMMUNITY
// ==========================================
console.log('  12. Verifying getEffectiveConcurrency handling of extreme network values...')

import { getEffectiveConcurrency } from '../src/queue.js'

// Extreme / NaN / Negative / Infinity inputs
const testNetworkInputs = [
    { downlink: NaN, rtt: NaN },
    { downlink: -5, rtt: -100 },
    { downlink: Infinity, rtt: 0 },
    { downlink: 0, rtt: Infinity },
    { downlink: 'fast', rtt: 'slow' },
    { downlink: null, rtt: null },
    { downlink: undefined, rtt: undefined },
]

for (const netInput of testNetworkInputs) {
    setMockNavigator({ connection: netInput })
    assert.doesNotThrow(() => {
        const conc = getEffectiveConcurrency({ adaptiveConcurrency: true, maxConcurrent: 3 })
        assert.ok(typeof conc === 'number' && conc >= 1, `Concurrency must be a valid number >= 1 for input: ${JSON.stringify(netInput)}`)
    }, `Extreme network input ${JSON.stringify(netInput)} must not throw`)
}

console.log('    ✓ Extreme Network Information API inputs validated safely')

// ==========================================
// 13. E-COMMERCE CART & CHECKOUT MUTATION DEFENSE
// ==========================================
console.log('  13. Verifying e-commerce cart mutation protection against evasion attempts...')

setConfig({ cartSafeguards: true })
const encodedCartAttacks = [
    '/%63art',
    '/%63heckout',
    '/shop/%63art/update',
    '/order/cancel',
    '/checkout?add-to-cart=99',
    '/api?wc-ajax=update_shipping_method',
    '/cart?empty-cart=true',
    '/cart?remove_item=987abc',
    '/cart?undo_item=987abc',
]

for (const attackPath of encodedCartAttacks) {
    const attackAnchor = {
        ...baseAnchor,
        href: `https://secure-bank.example.com${attackPath}`,
        pathname: attackPath.split('?')[0],
        search: attackPath.includes('?') ? '?' + attackPath.split('?')[1] : '',
    }
    assert.equal(isPreloadable(attackAnchor), false, `E-commerce cart attack must be blocked: ${attackPath}`)
}

// Button attribute evasion
const buttonAttacks = [
    { ...baseAnchor, hasAttribute: (a) => a === 'data-cart-action' },
    { ...baseAnchor, hasAttribute: (a) => a === 'data-add-to-cart' },
    { ...baseAnchor, classList: { contains: (c) => c === 'add_to_cart_button' } },
]
for (const btn of buttonAttacks) {
    assert.equal(isPreloadable(btn), false, 'Cart action button elements must be blocked')
}
resetConfig()
console.log('    ✓ E-Commerce mutation attacks strictly neutralized')

// ==========================================
// 14. SUBRESOURCE CDN PRECONNECT PROTOCOL SAFETY
// ==========================================
console.log('  14. Verifying subresource CDN preconnect protocol isolation...')

import { extractExternalOrigins } from '../src/subresources.js'

const dangerousHtmlAssets = `
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="javascript:alert(1)">
    <link rel="stylesheet" href="data:text/css,.body{color:red}">
    <link rel="stylesheet" href="file:///etc/passwd">
    <link rel="stylesheet" href="https://legitimate-cdn.example.org/font.css">
</head>
</html>
`

const safeOrigins = extractExternalOrigins(dangerousHtmlAssets)
assert.equal(safeOrigins.length, 1)
assert.equal(safeOrigins[0], 'https://legitimate-cdn.example.org')
assert.ok(!safeOrigins.some(o => o.startsWith('javascript:') || o.startsWith('data:') || o.startsWith('file:')))
console.log('    ✓ CDN preconnect protocol safety confirmed (only http/https origins permitted)')

// ==========================================
// 15. DOUBLE PERCENT-ENCODING FILTER EVASION DEFENSE
// ==========================================
console.log('  15. Verifying multi-pass percent-encoding filter evasion defense...')

const doubleEncodedAttacks = [
    '/%2564elete',
    '/%256cogout',
    '/%2573ignout',
    '/%2564estroy',
    '/%2572emove',
    '/api/v1/%2564elete',
    '/account?action=%2564elete',
    '/dashboard?do=%256cogout',
    '/%2563art',
    '/%2563heckout',
]

for (const attack of doubleEncodedAttacks) {
    const attackAnchor = {
        ...baseAnchor,
        href: `https://secure-bank.example.com${attack}`,
        pathname: attack.split('?')[0],
        search: attack.includes('?') ? '?' + attack.split('?')[1] : '',
    }
    assert.equal(isPreloadable(attackAnchor), false, `Double-encoded evasion attack must be blocked: ${attack}`)
}
console.log('    ✓ Double percent-encoded evasion attacks strictly neutralized')

// ==========================================
// 16. SVGAElement TARGET ATTRIBUTE NORMALIZATION
// ==========================================
console.log('  16. Verifying SVGAElement target object normalization...')

// In SVG, target is an SVGAnimatedString object { baseVal: "" }
const svgAnchorDefault = {
    ...baseAnchor,
    href: 'https://secure-bank.example.com/dashboard/transfers',
    target: { baseVal: '', animVal: '' }
}
assert.equal(isPreloadable(svgAnchorDefault), true, 'SVGAElement with default empty target must be preloadable')

const svgAnchorSelf = {
    ...baseAnchor,
    href: 'https://secure-bank.example.com/dashboard/transfers',
    target: { baseVal: '_self', animVal: '_self' }
}
assert.equal(isPreloadable(svgAnchorSelf), true, 'SVGAElement with target="_self" must be preloadable')

const svgAnchorBlank = {
    ...baseAnchor,
    href: 'https://secure-bank.example.com/dashboard/transfers',
    target: { baseVal: '_blank', animVal: '_blank' }
}
assert.equal(isPreloadable(svgAnchorBlank), false, 'SVGAElement with target="_blank" must be blocked')

console.log('    ✓ SVGAElement target object normalized without false positives or negatives')

// ==========================================
// 17. PROGRAMMATIC PRELOAD SECURITY FILTERING
// ==========================================
console.log('  17. Verifying programmatic preload URL security guards...')

import { preload, isUrlPreloadable } from '../src/index.js'
import { getQueueStatus, resetQueue } from '../src/queue.js'

assert.equal(isUrlPreloadable('https://secure-bank.example.com/logout'), false, 'Programmatic preload must reject /logout')
assert.equal(isUrlPreloadable('https://secure-bank.example.com/cart'), false, 'Programmatic preload must reject /cart')
assert.equal(isUrlPreloadable('https://evil-phishing.example.org/steal'), false, 'Programmatic preload must reject unauthorized external origin')
assert.equal(isUrlPreloadable('javascript:alert(1)'), false, 'Programmatic preload must reject javascript scheme')
assert.equal(isUrlPreloadable('https://secure-bank.example.com/dashboard/transfers'), true, 'Programmatic preload must allow legitimate URL')

resetQueue()
preload('https://secure-bank.example.com/logout')
preload('javascript:alert(1)')
preload('https://evil-phishing.example.org/exploit')
assert.equal(getQueueStatus().preloadedCount, 0, 'No sensitive, malicious, or external URLs may enter prefetch queue via preload()')

preload('https://secure-bank.example.com/dashboard/transfers')
assert.equal(getQueueStatus().preloadedCount, 1, 'Legitimate URL safely enqueued')
resetQueue()

console.log('    ✓ Programmatic preload() strictly guarded by security validation')

// ==========================================
// 18. PROTOTYPE POLLUTION DEFENSE IN MARKOV MODEL
// ==========================================
console.log('  18. Verifying prototype pollution immunity in Markov transitions...')

import { predictNextLink } from '../src/markov.js'

let storageData = {}
globalThis.localStorage = {
    getItem: (k) => storageData[k] || null,
    setItem: (k, v) => { storageData[k] = String(v) },
    removeItem: (k) => { delete storageData[k] },
    clear: () => { storageData = {} }
}

// Attempt prototype pollution via __proto__, constructor, and prototype
recordTransition('__proto__', 'pollutedKey')
recordTransition('/home', '__proto__')
recordTransition('constructor', 'pollutedKey2')
recordTransition('prototype', 'pollutedKey3')

assert.equal(({}).pollutedKey, undefined, 'Object.prototype must not be polluted via __proto__ fromPath')
assert.equal(({}).pollutedKey2, undefined, 'Object.prototype must not be polluted via constructor')
assert.equal(({}).pollutedKey3, undefined, 'Object.prototype must not be polluted via prototype')
assert.equal(predictNextLink('__proto__'), null, 'predictNextLink must reject __proto__')
assert.equal(predictNextLink('constructor'), null, 'predictNextLink must reject constructor')

console.log('    ✓ Markov model completely immune to prototype pollution')

// ==========================================
// 19. DATASET BEACON URL PROTOCOL & DOWNGRADE SAFETY
// ==========================================
console.log('  19. Verifying dataset beaconUrl protocol validation & downgrade defense...')

import { parseDatasetConfig } from '../src/config.js'

const dangerousBeaconDatasets = [
    { flashBeaconUrl: 'javascript:alert(1)' },
    { flashBeaconUrl: 'data:text/html,<script>alert(1)</script>' },
    { flashBeaconUrl: 'file:///etc/passwd' },
    { flashBeaconUrl: 'http://insecure-logger.example.org/collect' } // HTTP downgrade on HTTPS origin
]

for (const badDataset of dangerousBeaconDatasets) {
    const parsed = parseDatasetConfig(badDataset)
    assert.equal(parsed.beaconUrl, undefined, `Dangerous beaconUrl must be rejected: ${badDataset.flashBeaconUrl}`)
}

const safeDataset = { flashBeaconUrl: 'https://secure-bank.example.com/api/telemetry' }
const parsedSafe = parseDatasetConfig(safeDataset)
assert.equal(parsedSafe.beaconUrl, 'https://secure-bank.example.com/api/telemetry', 'Valid HTTPS beaconUrl must be accepted')

console.log('    ✓ Dataset beacon URL protocol safety and downgrade defense confirmed')

// ==========================================
// 20. DOM ELEMENT ACCUMULATION & MEMORY LEAK DEFENSE
// ==========================================
console.log('  20. Verifying DOM element lifecycle and memory leak capping...')

import { preloadUsingLink, resetEngine } from '../src/engines.js'

let appendedElements = []
globalThis.document = {
    head: {
        appendChild: (el) => {
            el.parentNode = globalThis.document.head
            appendedElements.push(el)
        },
        removeChild: (el) => {
            appendedElements = appendedElements.filter(e => e !== el)
        }
    },
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: (ev, fn) => { if (ev === 'load') setTimeout(fn, 1) },
        parentNode: null
    }),
    querySelectorAll: () => [...appendedElements]
}

// Prefetch 30 links with link engine - active link nodes should be capped at 25
for (let i = 0; i < 30; i++) {
    await preloadUsingLink(`https://secure-bank.example.com/page-${i}`)
}
assert.ok(appendedElements.length <= 25, `Appended link elements (${appendedElements.length}) must not exceed rolling cap of 25`)

resetEngine()
assert.equal(appendedElements.length, 0, 'resetEngine must cleanly flush all injected elements')

console.log('    ✓ DOM element memory leak capping and lifecycle cleanup verified')

console.log('\n🔒 ALL SECURITY, EXPLOIT & EDGE CASE AUDITS PASSED WITH ZERO VULNERABILITIES!')
