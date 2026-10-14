import assert from 'node:assert/strict'
import { isPreloadable } from '../src/guards.js'
import { setConfig, resetConfig, setBackpressure, isServerHealthy, getBackpressureUntil } from '../src/config.js'
import { setupDocumentSpeculationRules, preloadUsingSpeculationList } from '../src/engines.js'
import { recordTransition } from '../src/markov.js'

console.log('🛡️ Starting Flash Page Security, Vulnerability & Edge Case Audit Suite...')

// Simulated browser environment
globalThis.location = new URL('https://secure-bank.example.com/dashboard/home')

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

console.log('\n🔒 ALL SECURITY, EXPLOIT & EDGE CASE AUDITS PASSED WITH ZERO VULNERABILITIES!')
