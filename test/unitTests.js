import assert from 'node:assert/strict'
import { isPreloadable, status, getMetrics } from '../flashpage.js'

globalThis.location = new URL('https://example.com/blog/article-1')

console.log('Running Flash Page v1.0.0 Unit Tests...')

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

console.log('✅ All Flash Page v1.0.0 Unit Tests Passed!')
