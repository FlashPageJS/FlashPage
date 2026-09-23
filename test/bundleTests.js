import assert from 'node:assert/strict'

console.log('🧪 Starting Flash Page Bundle Integrity & Parity Test Suite...')

// 1. Dynamic imports of all four bundles
const full = await import('../flashpage.js')
const fullMin = await import('../flashpage.min.js')
const lite = await import('../flashpage.lite.js')
const liteMin = await import('../flashpage.lite.min.js')

console.log('  ✓ All 4 bundles successfully imported via ESM')

// 2. Export Parity Checks
const expectedFullExports = [
    'destroy',
    'extractSubresources',
    'getAnchorHref',
    'getBackpressureUntil',
    'getConfig',
    'getMetrics',
    'init',
    'isEnvironmentEligible',
    'isPreloadable',
    'isServerHealthy',
    'predictNextLink',
    'preload',
    'recordTransition',
    'resetConfig',
    'setBackpressure',
    'setCachedBattery',
    'setConfig',
    'status',
    'toggleHUD',
    'useFlashPage',
    'vFlash',
].sort()

const expectedLiteExports = [
    'destroy',
    'getAnchorHref',
    'getMetrics',
    'init',
    'isPreloadable',
    'isServerHealthy',
    'preload',
    'status',
].sort()

assert.deepEqual(Object.keys(full).sort(), expectedFullExports, 'flashpage.js exports mismatch')
assert.deepEqual(Object.keys(fullMin).sort(), expectedFullExports, 'flashpage.min.js exports mismatch')
assert.deepEqual(Object.keys(lite).sort(), expectedLiteExports, 'flashpage.lite.js exports mismatch')
assert.deepEqual(Object.keys(liteMin).sort(), expectedLiteExports, 'flashpage.lite.min.js exports mismatch')
console.log('  ✓ Export parity verified across full and lite, standard and minified')

// 3. Smoke Test Full Minified Bundle
globalThis.location = new URL('https://bundle-test.com/home')
globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
}
globalThis.document = {
    readyState: 'complete',
    createElement: () => ({
        setAttribute: () => {},
        getAttribute: () => null,
        style: {},
        relList: { supports: () => true, contains: () => false },
        appendChild: () => {},
        removeChild: () => {},
    }),
    head: { appendChild: () => {} },
    body: { dataset: {}, appendChild: () => {} },
    documentElement: { clientWidth: 1024, clientHeight: 768, appendChild: () => {} },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
}

assert.equal(fullMin.isPreloadable(null), false)
assert.equal(fullMin.isPreloadable({ href: 'https://bundle-test.com/about', hasAttribute: () => false, relList: { contains: () => false }, dataset: {} }), true)

fullMin.init({ allowQueryString: true, debug: false })
assert.equal(fullMin.status().initialized, true)
assert.equal(fullMin.getConfig().allowQueryString, true)

fullMin.preload('https://bundle-test.com/contact', 'high')
assert.equal(fullMin.status().preloadedCount, 1)

fullMin.destroy()
assert.equal(fullMin.status().initialized, false)
assert.equal(fullMin.status().preloadedCount, 0)
console.log('  ✓ Full minified bundle (flashpage.min.js) runtime smoke tests passed')

// 4. Smoke Test Lite Minified Bundle
assert.equal(liteMin.isPreloadable(null), false)
assert.equal(liteMin.isPreloadable({ href: 'https://bundle-test.com/products', hasAttribute: () => false, relList: { contains: () => false }, dataset: {} }), true)

liteMin.init({ allowQueryString: false })
assert.equal(liteMin.status().initialized, true)
liteMin.preload('https://bundle-test.com/cart', 'auto')
assert.equal(liteMin.status().preloadedCount, 1)

liteMin.destroy()
assert.equal(liteMin.status().initialized, false)
assert.equal(liteMin.status().preloadedCount, 0)
console.log('  ✓ Lite minified bundle (flashpage.lite.min.js) runtime smoke tests passed')

console.log('🎉 ALL FLASH PAGE BUNDLE INTEGRITY & PARITY TESTS PASSED!')
