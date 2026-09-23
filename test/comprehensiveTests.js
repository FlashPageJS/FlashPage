import assert from 'node:assert/strict'
import { isPreloadable, init, preload, destroy, status, getMetrics } from '../flashpage.js'

console.log('🧪 Starting Flash Page v1.0.0 Exhaustive Test Suite...')

// Setup simulated browser environment
globalThis.location = new URL('https://mywebsite.com/blog/article-1')

// 1. Null & Malformed Elements
assert.equal(isPreloadable(null), false, 'Should reject null')
assert.equal(isPreloadable(undefined), false, 'Should reject undefined')
assert.equal(isPreloadable({}), false, 'Should reject empty object')
assert.equal(isPreloadable({ href: '' }), false, 'Should reject empty string href')
assert.equal(isPreloadable({ href: null }), false, 'Should reject null href')
assert.equal(isPreloadable({ href: '   ' }), false, 'Should reject whitespace href')

// 2. Standard HTMLAnchorElement
const baseAnchor = {
    href: 'https://mywebsite.com/blog/article-2',
    hasAttribute: () => false,
    relList: { contains: () => false },
    dataset: {}
}
assert.equal(isPreloadable(baseAnchor), true, 'Should accept standard same-origin anchor')

// 3. SVGAElement & Custom Element href handling
const svgAnchor = {
    href: { baseVal: 'https://mywebsite.com/dashboard' },
    hasAttribute: () => false,
    relList: { contains: () => false },
    dataset: {}
}
assert.equal(isPreloadable(svgAnchor), true, 'Should accept SVG anchor with href.baseVal')

const customElementAnchor = {
    getAttribute: (name) => name === 'href' ? 'https://mywebsite.com/docs' : null,
    hasAttribute: () => false,
    relList: { contains: () => false },
    dataset: {}
}
assert.equal(isPreloadable(customElementAnchor), true, 'Should accept anchor using getAttribute("href")')

// 4. Download Attribute Guard
const downloadAnchor = {
    ...baseAnchor,
    hasAttribute: (attr) => attr === 'download'
}
assert.equal(isPreloadable(downloadAnchor), false, 'Should reject download attribute')

// Target Attribute Guard (e.g. target="_blank")
const blankAnchor = {
    ...baseAnchor,
    target: '_blank'
}
assert.equal(isPreloadable(blankAnchor), false, 'Should reject target="_blank"')

const selfAnchor = {
    ...baseAnchor,
    target: '_self'
}
assert.equal(isPreloadable(selfAnchor), true, 'Should accept target="_self"')

// 5. rel="nofollow" Guard
const nofollowAnchor = {
    ...baseAnchor,
    relList: { contains: (r) => r === 'nofollow' }
}
assert.equal(isPreloadable(nofollowAnchor), false, 'Should reject rel="nofollow"')

// 6. Blacklist data-no-flash
const noFlashAnchor = {
    ...baseAnchor,
    dataset: { noFlash: '' }
}
assert.equal(isPreloadable(noFlashAnchor), false, 'Should reject data-no-flash')

// 7. Action Methods (Rails, Turbo, HTMX)
const railsMethod = { ...baseAnchor, hasAttribute: (a) => a === 'data-method' }
const turboMethod = { ...baseAnchor, hasAttribute: (a) => a === 'data-turbo-method' }
const hxPost = { ...baseAnchor, hasAttribute: (a) => a === 'hx-post' }
const hxDelete = { ...baseAnchor, hasAttribute: (a) => a === 'hx-delete' }

assert.equal(isPreloadable(railsMethod), false, 'Should reject data-method')
assert.equal(isPreloadable(turboMethod), false, 'Should reject data-turbo-method')
assert.equal(isPreloadable(hxPost), false, 'Should reject hx-post')
assert.equal(isPreloadable(hxDelete), false, 'Should reject hx-delete')

// 8. Sensitive Action URL Endpoints
const logoutUrls = [
    'https://mywebsite.com/logout',
    'https://mywebsite.com/auth/signout',
    'https://mywebsite.com/posts/42/delete',
    'https://mywebsite.com/account/destroy',
]
logoutUrls.forEach(url => {
    assert.equal(isPreloadable({ ...baseAnchor, href: url }), false, `Should reject action URL: ${url}`)
})

// 9. Protocol Filtering
const nonHttpProtocols = [
    'javascript:alert(1)',
    'mailto:support@mywebsite.com',
    'tel:+1234567890',
    'ftp://ftp.mywebsite.com/file',
    'file:///C:/test.txt'
]
nonHttpProtocols.forEach(url => {
    assert.equal(isPreloadable({ ...baseAnchor, href: url }), false, `Should reject protocol for: ${url}`)
})

// 10. Mixed Content Guard (http on https)
const insecureLink = { ...baseAnchor, href: 'http://mywebsite.com/page' }
assert.equal(isPreloadable(insecureLink), false, 'Should reject http: link on https: origin')

// 11. Hash Anchors (Same-Page vs Cross-Page)
const samePageHash = { ...baseAnchor, href: 'https://mywebsite.com/blog/article-1#comments' }
const otherPageHash = { ...baseAnchor, href: 'https://mywebsite.com/blog/article-2#comments' }

assert.equal(isPreloadable(samePageHash), false, 'Should reject same-page hash fragment')
assert.equal(isPreloadable(otherPageHash), true, 'Should accept cross-page navigation with hash')

// 12. Query String Restrictions & Overrides
const queryLink = { ...baseAnchor, href: 'https://mywebsite.com/search?q=test' }
assert.equal(isPreloadable(queryLink), false, 'Should reject query string by default')

const queryLinkWhitelisted = { ...queryLink, dataset: { flash: '' } }
assert.equal(isPreloadable(queryLinkWhitelisted), true, 'Should allow query string when marked with data-flash')

// 13. External Links & Overrides
const externalLink = { ...baseAnchor, href: 'https://external-domain.com/landing' }
assert.equal(isPreloadable(externalLink), false, 'Should reject external link by default')

const externalWhitelisted = { ...externalLink, dataset: { flash: '' } }
assert.equal(isPreloadable(externalWhitelisted), true, 'Should allow external link with data-flash')

// 14. Programmatic Lifecycle & Status
// Initial state before init()
const initialStatus = status()
assert.equal(typeof initialStatus.initialized, 'boolean')
assert.equal(typeof initialStatus.preloadedCount, 'number')

// Programmatic preload
preload('https://mywebsite.com/blog/article-99', 'high')
assert.equal(status().preloadedCount, 1, 'preloadedCount should increment')

// Duplicate preload should be de-duped
preload('https://mywebsite.com/blog/article-99', 'high')
assert.equal(status().preloadedCount, 1, 'Duplicate preload should be ignored')

// Destroy lifecycle
destroy()
assert.equal(status().initialized, false, 'Should be uninitialized after destroy()')
assert.equal(status().preloadedCount, 0, 'preloadedUrls should be reset after destroy()')
assert.equal(status().queueLength, 0, 'queue should be cleared after destroy()')

// Telemetry API
const metrics = getMetrics()
assert.ok(Array.isArray(metrics), 'getMetrics should return an array')

// 15. Custom Filter Function
init({
    filter: (url) => !url.pathname.startsWith('/admin')
})

const adminLink = { ...baseAnchor, href: 'https://mywebsite.com/admin/settings' }
const publicLink = { ...baseAnchor, href: 'https://mywebsite.com/public/about' }

assert.equal(isPreloadable(adminLink), false, 'Custom filter should reject /admin')
assert.equal(isPreloadable(publicLink), true, 'Custom filter should accept /public')

destroy()

// 16. Whitelist Mode
init({ whitelist: true })

const nonWhitelisted = { ...baseAnchor, href: 'https://mywebsite.com/page-a' }
const whitelisted = { ...baseAnchor, href: 'https://mywebsite.com/page-b', dataset: { flash: '' } }

assert.equal(isPreloadable(nonWhitelisted), false, 'Whitelist mode should reject link without data-flash')
assert.equal(isPreloadable(whitelisted), true, 'Whitelist mode should accept link with data-flash')

destroy()

// 17. Query String Allowed Option
init({ allowQueryString: true })

const queryParamLink = { ...baseAnchor, href: 'https://mywebsite.com/products?sort=price' }
assert.equal(isPreloadable(queryParamLink), true, 'Should allow query strings when allowQueryString is true')

destroy()

// 18. External Links Allowed Option
init({ allowExternalLinks: true })

const extLink = { ...baseAnchor, href: 'https://partner-website.com/landing' }
assert.equal(isPreloadable(extLink), true, 'Should allow external links when allowExternalLinks is true')

// 19. Client-Side Markov Navigation Model (Predictive AI)
const storageMock = {}
globalThis.localStorage = {
    getItem: (key) => storageMock[key] || null,
    setItem: (key, val) => { storageMock[key] = String(val) },
    removeItem: (key) => { delete storageMock[key] }
}

import { recordTransition, predictNextLink, extractSubresources, isServerHealthy, toggleHUD, useFlashPage, vFlash, getAnchorHref } from '../flashpage.js'

// No transitions yet
assert.equal(predictNextLink('/shop'), null, 'Should return null when no data recorded')

// Record transitions from /shop -> /checkout (4 times) and /shop -> /contact (1 time)
recordTransition('/shop', '/checkout')
recordTransition('/shop', '/checkout')
recordTransition('/shop', '/checkout')
recordTransition('/shop', '/checkout')
recordTransition('/shop', '/contact')

// 4 / 5 = 80% probability (exceeds 60% threshold, >= 3 visits)
assert.equal(predictNextLink('/shop'), '/checkout', 'Should predict /checkout as next high-probability destination')

// Low confidence test: only 1 visit should return null (< 3 visits)
recordTransition('/blog', '/article-1')
assert.equal(predictNextLink('/blog'), null, 'Should return null when sample count is less than 3')

// 20. Subresource Link Extraction
const sampleHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <link rel="stylesheet" href="/assets/main.css">
      <link rel="stylesheet" href="https://cdn.com/theme.css">
      <link rel="preload" as="font" href="/fonts/inter.woff2">
      <link rel="icon" href="/favicon.ico">
    </head>
  </html>
`
const extracted = extractSubresources(sampleHtml)
assert.equal(extracted.length, 3, 'Should extract 2 stylesheets and 1 font')
assert.equal(extracted[0], '/assets/main.css')
assert.equal(extracted[1], 'https://cdn.com/theme.css')
assert.equal(extracted[2], '/fonts/inter.woff2')

// 21. Server Backpressure & Health Reporting
assert.equal(isServerHealthy(), true, 'Server should be healthy by default')
const currentStatus = status()
assert.equal(currentStatus.isHealthy, true, 'status() should report healthy')
assert.equal(currentStatus.backpressureUntil, 0, 'backpressureUntil should be 0')

// 22. Framework Utilities (React & Vue)
assert.equal(typeof useFlashPage, 'function', 'useFlashPage should be a function')
assert.equal(typeof vFlash, 'object', 'vFlash should be an object')
assert.equal(typeof vFlash.mounted, 'function', 'vFlash.mounted should be a function')

// Test vFlash directive execution
const vueAnchor = {
    href: 'https://mywebsite.com/dashboard',
    setAttribute: (attr, val) => { vueAnchor[attr] = val }
}
vFlash.mounted(vueAnchor)
assert.equal(vueAnchor['data-flash'], '', 'vFlash should set data-flash attribute')

// 23. getAnchorHref Cross-Type Normalization
assert.equal(getAnchorHref(null), null, 'getAnchorHref(null) should return null')
assert.equal(getAnchorHref(undefined), null, 'getAnchorHref(undefined) should return null')
assert.equal(getAnchorHref({}), null, 'getAnchorHref({}) should return null')
assert.equal(getAnchorHref({ href: 'https://site.com/page' }), 'https://site.com/page', 'Should extract standard string href')
assert.equal(getAnchorHref({ href: { baseVal: 'https://site.com/svg' } }), 'https://site.com/svg', 'Should extract SVGAnimatedString baseVal')
assert.equal(getAnchorHref({ getAttribute: (attr) => attr === 'href' ? 'https://site.com/custom' : null }), 'https://site.com/custom', 'Should extract via getAttribute')

// 24. Advanced Subresource Extraction (Attribute Ordering & Truncation)
const mixedOrderHtml = `
  <link href="/css/primary.css" rel="stylesheet">
  <link href="/fonts/font.woff2" as="font" rel="preload">
  <link rel='stylesheet' href='https://cdn.example.com/app.css'>
  <link as='font' href='/fonts/font2.woff2' rel='preload'>
  <link rel="stylesheet" href="/css/extra-ignored.css">
`
const mixedExtracted = extractSubresources(mixedOrderHtml)
assert.equal(mixedExtracted.length, 4, 'Should truncate to max 4 subresources')
assert.equal(mixedExtracted[0], '/css/primary.css', 'Should extract href when href precedes rel')
assert.equal(mixedExtracted[1], '/fonts/font.woff2', 'Should extract font when href precedes as')
assert.equal(mixedExtracted[2], 'https://cdn.example.com/app.css', 'Should extract single-quoted stylesheet')
assert.equal(mixedExtracted[3], '/fonts/font2.woff2', 'Should extract single-quoted font')

// 25. Subresource Extraction Edge Cases
assert.deepEqual(extractSubresources(null), [], 'Should return empty array for null HTML')
assert.deepEqual(extractSubresources(''), [], 'Should return empty array for empty HTML')
assert.deepEqual(extractSubresources('<div>No links here</div>'), [], 'Should return empty array when no links present')

// 26. Status Health & Queue Reporting Edge Cases
destroy()
const postDestroyStatus = status()
assert.equal(postDestroyStatus.initialized, false, 'status.initialized should be false after destroy')
assert.equal(postDestroyStatus.preloadedCount, 0, 'status.preloadedCount should be 0 after destroy')
assert.equal(postDestroyStatus.inflightCount, 0, 'status.inflightCount should be 0 after destroy')

// 27. HTML Dataset Configuration Parsing Parity (All Parameters)
import { parseDatasetConfig } from '../src/config.js'

const fullDatasetMock = {
    flashIntensity: 'viewport-all',
    flashDelayOnHover: '120',
    flashAllowQueryString: '',
    flashAllowExternalLinks: '',
    flashWhitelist: '',
    flashSpecrules: 'prerender',
    flashPredictive: '',
    flashNoIntentCone: '',
    flashNoDataSaver: '',
    flashNoBattery: '',
    flashNoSafariFallback: '',
    flashMaxConcurrent: '5',
    flashDebug: '',
    flashHud: '',
    flashSubresources: '',
    flashNoMarkov: '',
    flashNoBackpressure: ''
}

const parsedFull = parseDatasetConfig(fullDatasetMock)
assert.equal(parsedFull.intensity, 'viewport-all', 'Should parse flashIntensity')
assert.equal(parsedFull.delayOnHover, 120, 'Should parse flashDelayOnHover as integer')
assert.equal(parsedFull.allowQueryString, true, 'Should parse flashAllowQueryString')
assert.equal(parsedFull.allowExternalLinks, true, 'Should parse flashAllowExternalLinks')
assert.equal(parsedFull.whitelist, true, 'Should parse flashWhitelist')
assert.equal(parsedFull.specrules, 'prerender', 'Should parse flashSpecrules')
assert.equal(parsedFull.predictive, true, 'Should parse flashPredictive')
assert.equal(parsedFull.intentCone, false, 'Should parse flashNoIntentCone')
assert.equal(parsedFull.respectDataSaver, false, 'Should parse flashNoDataSaver')
assert.equal(parsedFull.respectBattery, false, 'Should parse flashNoBattery')
assert.equal(parsedFull.safariFallback, false, 'Should parse flashNoSafariFallback')
assert.equal(parsedFull.maxConcurrent, 5, 'Should parse flashMaxConcurrent as integer')
assert.equal(parsedFull.debug, true, 'Should parse flashDebug')
assert.equal(parsedFull.hud, true, 'Should parse flashHud')
assert.equal(parsedFull.subresources, true, 'Should parse flashSubresources')
assert.equal(parsedFull.markov, false, 'Should parse flashNoMarkov')
assert.equal(parsedFull.backpressure, false, 'Should parse flashNoBackpressure')

console.log('✅ ALL EXHAUSTIVE UNIT, AI, DATASET & ADVANCED TESTS PASSED (75/75)!')
