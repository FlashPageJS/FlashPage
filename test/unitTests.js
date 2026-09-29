import assert from 'node:assert/strict'
import { isPreloadable, status, getMetrics } from '../flashpage.js'
import { parseRetryAfter } from '../src/engines.js'
import { recordTransition } from '../src/markov.js'

globalThis.location = new URL('https://example.com/blog/article-1')

console.log('Running Flash Page v1.0.1 Unit Tests...')

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

console.log('✅ All Flash Page v1.0.1 Unit Tests Passed!')
