/*! Flash Page - Live HTTP Server End-to-End Worst-Condition Audit */

import http from 'http'

const PORT = 8085
const BASE_URL = `http://127.0.0.1:${PORT}`

let passed = 0
let failed = 0

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`)
        passed++
    } else {
        console.error(`  ✗ FAIL: ${message}`)
        failed++
    }
}

function fetchUrl(path, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.get(`${BASE_URL}${path}`, { headers }, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body
            }))
        })
        req.on('error', reject)
    })
}

async function run() {
    console.log(`🌐 Connecting to Live Flash Page Server at ${BASE_URL}...\n`)

    try {
        // 1. Verify Workbench HTML
        const liveRes = await fetchUrl('/live')
        assert(liveRes.statusCode === 200, 'GET /live returns HTTP 200 OK')
        assert(liveRes.headers['content-type'].includes('text/html'), 'GET /live Content-Type is text/html')
        assert(liveRes.body.includes('Flash Page - Live HTML Test Workbench'), 'GET /live contains workbench header')
        assert(liveRes.body.includes('All 28 Master Parameters'), 'GET /live contains All 28 Master Parameters dashboard')
        assert(liveRes.body.includes('btn-simulate-429'), 'GET /live contains 429 backpressure control')
        assert(liveRes.body.includes('btn-toggle-hud'), 'GET /live contains DevTools HUD toggle')
        assert(liveRes.body.includes('btn-test-cart-shield'), 'GET /live contains Cart & Checkout Shield test button')
        assert(liveRes.body.includes('btn-test-priority-queue'), 'GET /live contains Priority Queue Lanes test button')
        assert(liveRes.body.includes('btn-test-preconnect-cdn'), 'GET /live contains CDN Preconnect Handshake test button')
        assert(liveRes.body.includes('cfg-adaptive-concurrency'), 'GET /live contains adaptiveConcurrency toggle')
        assert(liveRes.body.includes('cfg-cart-safeguards'), 'GET /live contains cartSafeguards toggle')
        assert(liveRes.body.includes('cfg-priority-queue'), 'GET /live contains priorityQueue toggle')
        assert(liveRes.body.includes('cfg-preconnect-cdn'), 'GET /live contains preconnectCdn toggle')
        assert(liveRes.body.includes('cfg-isolate-heatmaps'), 'GET /live contains isolateHeatmaps toggle')
        assert(liveRes.body.includes('cfg-nonce'), 'GET /live contains nonce CSP input')
        assert(liveRes.body.includes('cfg-analytics'), 'GET /live contains analytics selector')
        assert(liveRes.body.includes('cfg-beacon-url'), 'GET /live contains beaconUrl input')

        // 2. Verify flashpage.js bundle serving
        const jsRes = await fetchUrl('/flashpage.js')
        assert(jsRes.statusCode === 200, 'GET /flashpage.js returns HTTP 200 OK')
        assert(jsRes.headers['content-type'].includes('javascript'), 'GET /flashpage.js Content-Type is text/javascript')
        assert(jsRes.body.includes('export function init'), 'GET /flashpage.js exports init()')
        assert(jsRes.body.includes('export function preload'), 'GET /flashpage.js exports preload()')
        assert(jsRes.body.includes('export function status'), 'GET /flashpage.js exports status()')

        // 3. Verify HTTP 429 Backpressure Simulation Endpoint
        const p429 = await fetchUrl('/simulate-429')
        assert(p429.statusCode === 429, 'GET /simulate-429 returns HTTP 429 Too Many Requests')
        assert(p429.headers['retry-after'] === '30', 'GET /simulate-429 provides Retry-After: 30 header')
        assert(p429.body.includes('Backpressure Simulation'), 'GET /simulate-429 contains backpressure notice')

        // 4. Verify Static Matrix Destination Pages
        const p1 = await fetchUrl('/test-page-1.html')
        assert(p1.statusCode === 200, 'GET /test-page-1.html returns HTTP 200 OK')
        assert(p1.body.includes('Standard Eligible Destination Page'), 'Destination page renders correct title')
        assert(p1.body.includes('Back to Live Workbench'), 'Destination page provides back link')

        // 5. Verify XSS Neutralization in Destination Page
        const xssPayload = '/test-page-1.html?<script>alert(1)</script>'
        const pXss = await fetchUrl(xssPayload)
        assert(!pXss.body.includes('<script>alert(1)</script>'), 'XSS payload in URL is NOT executed unescaped')
        assert(pXss.body.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'XSS payload in URL is properly HTML-escaped')

        // 6. Verify Dynamic Mutation Endpoints
        const dynRes = await fetchUrl('/dynamic-article-42.html')
        assert(dynRes.statusCode === 200, 'GET /dynamic-article-42.html returns HTTP 200 OK')
        assert(dynRes.body.includes('Dynamic Test Destination'), 'Dynamic article destination rendered')

        // 7. Verify Prefetch Headers Detection
        const pfRes = await fetchUrl('/test-page-1.html', {
            'purpose': 'prefetch',
            'sec-fetch-dest': 'document'
        })
        assert(pfRes.statusCode === 200, 'Prefetch request with Purpose: prefetch accepted and logged')

        // 8. Verify Download File Endpoint
        const zipRes = await fetchUrl('/archive.zip')
        assert(zipRes.statusCode === 200, 'GET /archive.zip returns HTTP 200 OK')
        assert(zipRes.headers['content-type'] === 'application/zip', 'GET /archive.zip Content-Type is application/zip')
        assert(zipRes.headers['content-disposition'].includes('attachment'), 'GET /archive.zip has attachment disposition')

        // 9. Multi-Page Navigation Simulation
        const page1 = await fetchUrl('/')
        assert(page1.statusCode === 200, 'Root navigation (Page 1) returns HTTP 200 OK')
        assert(page1.body.includes('Page 1'), 'Page 1 renders navigation links')

        const page2 = await fetchUrl('/2')
        assert(page2.statusCode === 200, 'Navigation (Page 2) returns HTTP 200 OK')
        assert(page2.body.includes('Page 2'), 'Page 2 renders navigation links')

        console.log(`\n======================================================`)
        console.log(`🎉 LIVE HTTP AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`)
        console.log(`======================================================`)

        if (failed > 0) process.exit(1)
        console.log('🛡️ LIVE TESTING AT http://127.0.0.1:8085/live IS 100% WORKING!')
    } catch (err) {
        console.error('Connection failed:', err.message)
        process.exit(1)
    }
}

run()
