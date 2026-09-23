import assert from 'node:assert/strict'
import {
    init,
    destroy,
    status,
    preload,
    isPreloadable,
    isServerHealthy,
    isEnvironmentEligible,
    setBackpressure,
    setCachedBattery,
    getConfig,
    setConfig,
    resetConfig,
    extractSubresources,
    recordTransition,
    predictNextLink,
} from '../flashpage.js'

import { logDebug } from '../src/config.js'
import { initTelemetry } from '../src/telemetry.js'

console.log('🧪 Starting Flash Page Master Parameters Matrix Test Suite (All 20 Parameters)...')

// Setup global mock browser environment
globalThis.location = new URL('https://example.com/blog/article-1')
try {
    delete globalThis.navigator
} catch {}
try {
    Object.defineProperty(globalThis, 'navigator', {
        value: {
            connection: null,
            deviceMemory: 4,
        },
        configurable: true,
        writable: true,
        enumerable: true
    })
} catch {
    globalThis.navigator = {
        connection: null,
        deviceMemory: 4,
    }
}
globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
}
globalThis.document = {
    readyState: 'complete',
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        setAttribute: () => {},
        getAttribute: () => null,
        style: {},
        relList: { supports: () => true, contains: () => false },
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    }),
    head: { appendChild: () => {} },
    body: { dataset: {}, appendChild: () => {} },
    documentElement: { clientWidth: 1024, clientHeight: 768, appendChild: () => {} },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
}
globalThis.CustomEvent = class CustomEvent {
    constructor(name, opts) {
        this.type = name
        this.detail = opts && opts.detail
    }
}
globalThis.sessionStorage = {
    data: {},
    getItem(k) { return this.data[k] || null },
    setItem(k, v) { this.data[k] = String(v) },
    removeItem(k) { delete this.data[k] },
    clear() { this.data = {} }
}
globalThis.localStorage = {
    data: {},
    getItem(k) { return this.data[k] || null },
    setItem(k, v) { this.data[k] = String(v) },
    removeItem(k) { delete this.data[k] },
    clear() { this.data = {} }
}

const baseAnchor = {
    href: 'https://example.com/blog/article-2',
    hasAttribute: () => false,
    relList: { contains: () => false },
    dataset: {}
}

// Parameter 1: intensity
// Supports: number (ms), 'mousedown', 'mousedown-only', 'viewport', 'viewport-all', 'predictive'
// 1.1 Number intensity (hover delay)
init({ intensity: 150 })
assert.equal(status().config.intensity, 150, 'intensity should accept custom number')
assert.equal(status().config.delayOnHover, 150, 'delayOnHover should sync with numerical intensity')
destroy()

// 1.2 'mousedown' intensity
init({ intensity: 'mousedown' })
assert.equal(status().config.intensity, 'mousedown', 'intensity should accept mousedown')
destroy()

// 1.3 'mousedown-only' intensity
init({ intensity: 'mousedown-only' })
assert.equal(status().config.intensity, 'mousedown-only', 'intensity should accept mousedown-only')
destroy()

// 1.4 'viewport' intensity
init({ intensity: 'viewport' })
assert.equal(status().config.intensity, 'viewport', 'intensity should accept viewport')
destroy()

// 1.5 'viewport-all' intensity
init({ intensity: 'viewport-all' })
assert.equal(status().config.intensity, 'viewport-all', 'intensity should accept viewport-all')
destroy()

// 1.6 'predictive' intensity
init({ intensity: 'predictive' })
assert.equal(status().config.intensity, 'predictive', 'intensity should accept predictive')
destroy()
console.log('  ✓ Parameter 1 (intensity) verified across all 6 modes')

// Parameter 2: delayOnHover
// Explicit hover delay in milliseconds
init({ delayOnHover: 350 })
assert.equal(status().config.delayOnHover, 350, 'delayOnHover should accept custom ms threshold')
destroy()
console.log('  ✓ Parameter 2 (delayOnHover) verified')

// Parameter 3: allowQueryString
// When false (default): rejects URLs with search params
// When true: permits URLs with search params
const queryAnchor = { ...baseAnchor, href: 'https://example.com/shop?category=books&sort=price' }

// Default: false
init({ allowQueryString: false })
assert.equal(isPreloadable(queryAnchor), false, 'allowQueryString: false must reject query strings')
destroy()

// Enabled: true
init({ allowQueryString: true })
assert.equal(isPreloadable(queryAnchor), true, 'allowQueryString: true must allow query strings')
destroy()
console.log('  ✓ Parameter 3 (allowQueryString) verified')

// Parameter 4: allowExternalLinks
// When false (default): rejects cross-origin URLs
// When true: permits cross-origin URLs
const externalAnchor = { ...baseAnchor, href: 'https://external-domain.com/landing' }

// Default: false
init({ allowExternalLinks: false })
assert.equal(isPreloadable(externalAnchor), false, 'allowExternalLinks: false must reject cross-origin links')
destroy()

// Enabled: true
init({ allowExternalLinks: true })
assert.equal(isPreloadable(externalAnchor), true, 'allowExternalLinks: true must allow cross-origin links')
destroy()
console.log('  ✓ Parameter 4 (allowExternalLinks) verified')

// Parameter 5: whitelist
// When false (default): preloads all eligible links
// When true: preloads ONLY links with data-flash attribute
const regularAnchor = { ...baseAnchor }
const whitelistedAnchor = { ...baseAnchor, dataset: { flash: '' } }

// Default: false
init({ whitelist: false })
assert.equal(isPreloadable(regularAnchor), true, 'whitelist: false should permit regular links')
assert.equal(isPreloadable(whitelistedAnchor), true, 'whitelist: false should permit whitelisted links')
destroy()

// Enabled: true
init({ whitelist: true })
assert.equal(isPreloadable(regularAnchor), false, 'whitelist: true must reject non-whitelisted links')
assert.equal(isPreloadable(whitelistedAnchor), true, 'whitelist: true must permit links with data-flash')
destroy()
console.log('  ✓ Parameter 5 (whitelist) verified')

// Parameter 6: specrules
// Mode for Speculation Rules: 'prefetch' | 'prerender' | 'no'
init({ specrules: 'prerender' })
assert.equal(status().config.specrules, 'prerender', 'specrules should accept prerender')
destroy()

init({ specrules: 'no' })
assert.equal(status().config.specrules, 'no', 'specrules should accept no')
destroy()

init({ specrules: 'prefetch' })
assert.equal(status().config.specrules, 'prefetch', 'specrules should default to prefetch')
destroy()
console.log('  ✓ Parameter 6 (specrules) verified for prefetch, prerender & no')

// Parameter 7: predictive
// Controls mouse trajectory projection
init({ predictive: true })
assert.equal(status().config.predictive, true, 'predictive should be true when enabled')
destroy()

init({ predictive: false })
assert.equal(status().config.predictive, false, 'predictive should be false when disabled')
destroy()
console.log('  ✓ Parameter 7 (predictive) verified')

// Parameter 8: intentCone
// Controls 3-point proximity intent cone for cursor physics
init({ intentCone: false })
assert.equal(status().config.intentCone, false, 'intentCone should be false when disabled')
destroy()

init({ intentCone: true })
assert.equal(status().config.intentCone, true, 'intentCone should be true by default')
destroy()
console.log('  ✓ Parameter 8 (intentCone) verified')

// Parameter 9: respectDataSaver
// When true (default): stops preloading when navigator.connection.saveData is on
// When false: overrides Data Saver
globalThis.navigator.connection = { saveData: true }

init({ respectDataSaver: true })
assert.equal(isEnvironmentEligible(), false, 'respectDataSaver: true must reject preloading when saveData is active')
destroy()

init({ respectDataSaver: false })
assert.equal(isEnvironmentEligible(), true, 'respectDataSaver: false must allow preloading even when saveData is active')
destroy()

globalThis.navigator.connection = null
console.log('  ✓ Parameter 9 (respectDataSaver) verified')

// Parameter 10: respectBattery
// When true (default): stops preloading when battery < 20% and discharging
// When false: overrides battery threshold
setCachedBattery({ level: 0.12, charging: false })

init({ respectBattery: true })
assert.equal(isEnvironmentEligible(), false, 'respectBattery: true must reject preloading on low discharging battery')
destroy()

init({ respectBattery: false })
assert.equal(isEnvironmentEligible(), true, 'respectBattery: false must allow preloading despite low battery')
destroy()

setCachedBattery(null)
console.log('  ✓ Parameter 10 (respectBattery) verified')

// Parameter 11: safariFallback
// When true (default): enables low-priority fetch fallback on WebKit
// When false: disables fetch fallback
init({ safariFallback: true })
assert.equal(status().config.safariFallback, true, 'safariFallback should be true by default')
destroy()

init({ safariFallback: false })
assert.equal(status().config.safariFallback, false, 'safariFallback should be false when disabled')
destroy()
console.log('  ✓ Parameter 11 (safariFallback) verified')

// Parameter 12: maxConcurrent
// Concurrency limiter for prefetch queue
init({ maxConcurrent: 7 })
assert.equal(status().config.maxConcurrent, 7, 'maxConcurrent should accept custom connection limits')
destroy()

init({ maxConcurrent: 1 })
assert.equal(status().config.maxConcurrent, 1, 'maxConcurrent should accept strict serial connection limit')
destroy()
console.log('  ✓ Parameter 12 (maxConcurrent) verified')

// Parameter 13: subresources
// When true: extracts critical CSS and fonts from HTML text
init({ subresources: true })
assert.equal(status().config.subresources, true, 'subresources should be true when enabled')

const htmlSample = `
  <html><head>
    <link href="/theme.css" rel="stylesheet">
    <link as="font" href="/main.woff2" rel="preload">
  </head></html>
`
const assets = extractSubresources(htmlSample)
assert.equal(assets.length, 2, 'extractSubresources should return found critical assets')
assert.equal(assets[0], '/theme.css')
assert.equal(assets[1], '/main.woff2')
destroy()
console.log('  ✓ Parameter 13 (subresources) verified')

// Parameter 14: markov
// Client-side Markov predictive navigation model
init({ markov: false })
assert.equal(status().config.markov, false, 'markov should be false when disabled')
destroy()

init({ markov: true })
assert.equal(status().config.markov, true, 'markov should be true by default')

// Verify transition recording and prediction
recordTransition('/home', '/products')
recordTransition('/home', '/products')
recordTransition('/home', '/products')
assert.equal(predictNextLink('/home'), '/products', 'predictNextLink should predict next URL')
destroy()
console.log('  ✓ Parameter 14 (markov) verified')

// Parameter 15: backpressure
// Server 429/503 automatic backoff
setBackpressure(45)

init({ backpressure: true })
assert.equal(isServerHealthy(), false, 'backpressure: true must report unhealthy when backoff is active')
assert.equal(isPreloadable(baseAnchor), false, 'backpressure: true must reject preloading during active backoff')
destroy()

init({ backpressure: false })
assert.equal(isServerHealthy(), true, 'backpressure: false must bypass backpressure status')
assert.equal(isPreloadable(baseAnchor), true, 'backpressure: false must permit preloading')
destroy()

// Reset backpressure
resetConfig()
console.log('  ✓ Parameter 15 (backpressure) verified')

// Parameter 16: debug
// Verbose console logging
init({ debug: true })
assert.equal(status().config.debug, true, 'debug should be true when enabled')
// Verify logDebug runs without crashing
logDebug('Test debug output')
destroy()

init({ debug: false })
assert.equal(status().config.debug, false, 'debug should be false by default')
destroy()
console.log('  ✓ Parameter 16 (debug) verified')

// Parameter 17: hud
// In-browser DevTools HUD overlay
init({ hud: true })
assert.equal(status().config.hud, true, 'hud should be true when enabled')
destroy()

init({ hud: false })
assert.equal(status().config.hud, false, 'hud should be false by default')
destroy()
console.log('  ✓ Parameter 17 (hud) verified')

// Parameter 18: filter
// Custom predicate function (url, anchor) => boolean
init({
    filter: (url, anchor) => {
        return !url.pathname.startsWith('/admin') && !anchor.dataset.ignoreMe
    }
})

const normalPage = { ...baseAnchor, href: 'https://example.com/blog' }
const adminPage = { ...baseAnchor, href: 'https://example.com/admin/settings' }
const ignoredElement = { ...baseAnchor, dataset: { ignoreMe: 'true' } }

assert.equal(isPreloadable(normalPage), true, 'filter should permit links passing predicate')
assert.equal(isPreloadable(adminPage), false, 'filter should reject links failing pathname predicate')
assert.equal(isPreloadable(ignoredElement), false, 'filter should reject links failing element predicate')
destroy()
console.log('  ✓ Parameter 18 (filter) verified')

// Parameter 19: onPreload
// Callback fired whenever a URL is queued/preloaded
let preloadCallbackFired = false
let recordedPreloadUrl = null

init({
    onPreload: (url, engine) => {
        preloadCallbackFired = true
        recordedPreloadUrl = url
    }
})

preload('https://example.com/blog/article-99')
// Allow microtask tick
await new Promise(r => setTimeout(r, 10))
assert.equal(preloadCallbackFired, true, 'onPreload callback must fire when preloading URL')
assert.equal(recordedPreloadUrl, 'https://example.com/blog/article-99')
destroy()
console.log('  ✓ Parameter 19 (onPreload) verified')

// Parameter 20: onMetric
// Performance navigation conversion callback
let metricCallbackFired = false
let capturedMetric = null

// Simulate navigation performance entry and preloaded URL in sessionStorage prior to page init
globalThis.sessionStorage.setItem('flash_preloads', JSON.stringify([
    { url: 'https://example.com/blog/article-1', time: Date.now() - 500 }
]))
globalThis.performance = {
    getEntriesByType: (type) => {
        if (type === 'navigation') {
            return [{ transferSize: 1240, duration: 42 }]
        }
        return []
    }
}

init({
    onMetric: (metric) => {
        metricCallbackFired = true
        capturedMetric = metric
    }
})

assert.equal(metricCallbackFired, true, 'onMetric callback must fire when conversion metric is captured')
assert.equal(capturedMetric.converted, true, 'metric.converted should be true for preloaded target')
assert.equal(capturedMetric.duration, 42, 'metric.duration should match performance entry')
assert.equal(capturedMetric.transferSize, 1240, 'metric.transferSize should match performance entry')
destroy()
console.log('  ✓ Parameter 20 (onMetric) verified')

console.log('\n🎉 ALL 20 MASTER PARAMETERS VERIFIED INDIVIDUALLY AND PASSED WITH 100% SUCCESS!')
