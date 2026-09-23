import http from 'http'
import fsModule from 'fs'
import crypto from 'crypto'
import util from 'util'

const fs = fsModule.promises || fsModule

import * as automatedTests from './automatedTests.js'

const sleep = util.promisify(setTimeout)

let PORT = parseInt(process.argv[2])
if (isNaN(PORT)) {
    PORT = 8000
}

let ALLOW_QUERY_STRING_AND_EXTERNAL_LINKS = 0
let SLEEP_TIME = 200
let CACHE_MAX_AGE = 0
let USE_WHITELIST = 0
let INTENSITY = 65
let USE_MINIFIED = 0
let VARY_ACCEPT = 'Off'

init()

function init(portToTry = PORT) {
    const server = http.createServer(requestListener)

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${portToTry} is already in use by another process.`)
            console.log(`👉 Automatically trying next available port: ${portToTry + 1}...`)
            init(portToTry + 1)
            return
        }
        console.error('Server error:', err)
        process.exit(1)
    })

    server.listen(portToTry, () => {
        PORT = portToTry
        console.log(`⚡ Flash Page Test Server:  http://127.0.0.1:${PORT}/`)
        console.log(`🚀 Live Test Workbench:    http://127.0.0.1:${PORT}/live`)
    })
}

async function requestListener(req, res) {
    const isPrefetched = req.headers['purpose'] == 'prefetch' /* Chromium link prefetch, WebKit */ ||
                                                (req.headers['sec-purpose'] && req.headers['sec-purpose'].startsWith('prefetch')) /* Chromium speculation rules, Firefox 115+ prefetch */
    const prefetchIndicator = isPrefetched ? 'PF' : ' F'
    const type = req.headers['sec-fetch-dest'] ? req.headers['sec-fetch-dest'].toUpperCase()[0] : '.'
    const spaces = ' '.repeat(Math.max(0, 16 - req.url.length))
    const date = new Date
    const dateTime = date.toLocaleTimeString('en-US', { hour12: false })
    const dateMilliseconds = String(date.getMilliseconds()).padStart(3, '0')
    console.log(`${dateTime}.${dateMilliseconds} ${prefetchIndicator}  ${type}  ${req.url} ${spaces}  ${req.headers['user-agent']}`)

    handleCookies(req)

    let headers = {
        'Content-Type': 'text/html',
    }

    let pathString = req.url.substr(1)
    let page = parseInt(pathString)
    if (pathString == '') {
        page = 1
    }

    let content = ''

    const jsPath = new URL(`../${USE_MINIFIED ? 'flashpage.min.js' : 'flashpage.js'}`, import.meta.url)
    const jsContent = await fs.readFile(jsPath)
    const jsHash = sha384(jsContent)

    if (pathString == 'simulate-429') {
        res.writeHead(429, {
            'Content-Type': 'text/plain',
            'Retry-After': '30',
        })
        res.end('429 Too Many Requests (Flash Page Server Backpressure Simulation)')
        return
    }

    if (pathString == 'live' || pathString == 'live-test' || pathString.endsWith('live-test.html')) {
        headers['Content-Type'] = 'text/html'
        const livePath = new URL('./live-test.html', import.meta.url)
        content = await fs.readFile(livePath, 'utf8')
        res.writeHead(200, headers)
        res.end(content)
        return
    }

    if (pathString == 'archive.zip') {
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="flashpage-demo.zip"',
        })
        res.end(Buffer.from('PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'))
        return
    }

    const cleanPath = pathString.split('?')[0]
    const matrixPages = {
        'test-page-1.html': {
            title: 'Standard Eligible Destination Page',
            icon: '📄',
            badgeClass: 'badge-success',
            badgeText: '✅ Speculatively Preloaded',
            description: 'This is a standard same-origin HTML page. Flash Page speculatively loaded it before you clicked, delivering instant zero-latency navigation.',
        },
        'test-page-fast.html': {
            title: 'Ultra-Fast Hover Override Destination',
            icon: '⚡',
            badgeClass: 'badge-success',
            badgeText: '✅ 20ms Hover Preloaded',
            description: 'This page was preloaded using a per-link speed override (data-flash-intensity="20"), kicking off prefetching within just 20 milliseconds of cursor contact.',
        },
        'test-whitelisted.html': {
            title: 'Explicitly Whitelisted Destination',
            icon: '🏷️',
            badgeClass: 'badge-success',
            badgeText: '✅ Whitelisted (data-flash)',
            description: 'This link carried the data-flash attribute. Even in strict whitelist mode, Flash Page prioritized and preloaded this destination.',
        },
        'test-legacy-whitelisted.html': {
            title: 'Legacy Whitelisted Destination',
            icon: '🔄',
            badgeClass: 'badge-success',
            badgeText: '✅ Legacy Whitelist (data-instant)',
            description: 'This link carried the legacy data-instant attribute, verifying 100% drop-in backward compatibility with existing instant.page codebases.',
        },
        'test-ignored.html': {
            title: 'Manually Blacklisted Page',
            icon: '🚫',
            badgeClass: 'badge-danger',
            badgeText: '🛡️ Blacklist Guard Enforced (data-no-flash)',
            description: 'This link was annotated with data-no-flash. Flash Page strictly ignored it, ensuring no speculative traffic was sent before click.',
        },
        'test-legacy-ignored.html': {
            title: 'Legacy Blacklisted Page',
            icon: '🛡️',
            badgeClass: 'badge-danger',
            badgeText: '🛡️ Legacy Blacklist Guard (data-no-instant)',
            description: 'This link was annotated with legacy data-no-instant. Flash Page safely ignored it, preserving backward compatibility.',
        },
        'test-newtab.html': {
            title: 'New Tab Destination Page',
            icon: '↗️',
            badgeClass: 'badge-warning',
            badgeText: '🛡️ Target Blank Guard Enforced',
            description: 'Links with target="_blank" are automatically excluded from speculation because browsers handle new tabs in isolated browsing contexts.',
        },
        'untrusted.html': {
            title: 'Search Engine Nofollow Destination',
            icon: '🔍',
            badgeClass: 'badge-warning',
            badgeText: '🛡️ SEO Nofollow Guard Enforced',
            description: 'Links marked with rel="nofollow" are excluded from speculation to honor search engine crawler and privacy instructions.',
        },
        'delete-item': {
            title: 'Turbo / Rails Destructive Action Route',
            icon: '🗑️',
            badgeClass: 'badge-danger',
            badgeText: '🛡️ Mutation Guard Enforced (data-turbo-method)',
            description: 'Links with declarative action attributes (data-turbo-method, data-method) are excluded to prevent accidental state-mutating requests.',
        },
        'submit-post': {
            title: 'HTMX Declarative POST Route',
            icon: '📬',
            badgeClass: 'badge-danger',
            badgeText: '🛡️ HTMX Guard Enforced (hx-post)',
            description: 'Links configured with HTMX mutation verbs (hx-post, hx-delete) are protected against speculative prefetching.',
        },
        'auth/logout': {
            title: 'Session Signout / Logout Route',
            icon: '🔒',
            badgeClass: 'badge-danger',
            badgeText: '🛡️ Sensitive Endpoint Guard Enforced (/logout)',
            description: 'Flash Page includes built-in safety rules preventing speculative GET requests to sensitive routes (/logout, /signout, /delete).',
        },
        'catalog': {
            title: 'Catalog Query Parameter Page',
            icon: '🔎',
            badgeClass: 'badge-warning',
            badgeText: 'Query Parameter Handling',
            description: 'Query string URLs (?category=books) are blocked by default to protect search endpoints, unless allowQueryString is toggled on in settings.',
        },
        'filter-blocked-demo.html': {
            title: 'Custom Filter Rule Target',
            icon: '🎯',
            badgeClass: 'badge-warning',
            badgeText: 'Conditional Custom Filter Target',
            description: 'This destination demonstrates the programmatic filter: (url, anchor) callback for custom domain-level exclusion rules.',
        },
        'target-alpha.html': {
            title: 'Vector Target Alpha',
            icon: '🧭',
            badgeClass: 'badge-success',
            badgeText: '✅ Trajectory Predicted Destination',
            description: 'Flash Page projected your cursor trajectory vector and preloaded Target Alpha before your pointer touched the element.',
        },
        'target-beta.html': {
            title: 'Vector Target Beta',
            icon: '🧭',
            badgeClass: 'badge-success',
            badgeText: '✅ Trajectory Predicted Destination',
            description: 'Flash Page projected your cursor trajectory vector and preloaded Target Beta along your movement angle.',
        },
        'target-gamma.html': {
            title: 'Vector Target Gamma',
            icon: '🧭',
            badgeClass: 'badge-success',
            badgeText: '✅ Trajectory Predicted Destination',
            description: 'Flash Page projected your cursor trajectory vector and preloaded Target Gamma based on intent cone calculation.',
        },
        'viewport-article.html': {
            title: 'Viewport Scrolled Article',
            icon: '📜',
            badgeClass: 'badge-success',
            badgeText: '✅ Viewport Intersection Preloaded',
            description: 'This page preloaded automatically when its link entered the visible viewport area via IntersectionObserver.',
        },
        'programmatic-demo.html': {
            title: 'Programmatic API Preload Destination',
            icon: '⚙️',
            badgeClass: 'badge-success',
            badgeText: '✅ Programmatically Preloaded (preload())',
            description: 'This page was preloaded via Flash Page programmatic JavaScript API: preload("/programmatic-demo.html", "high").',
        },
    }

    if (matrixPages[cleanPath]) {
        content = renderDestinationPage({
            ...matrixPages[cleanPath],
            reqUrl: req.url,
        })
        res.writeHead(200, headers)
        res.end(content)
        return
    }

    if (cleanPath.startsWith('dynamic-article-') || cleanPath.startsWith('burst-batch-')) {
        content = renderDestinationPage({
            title: `Dynamic Test Destination: ${cleanPath}`,
            icon: '⚡',
            badgeClass: 'badge-success',
            badgeText: '✅ Dynamically Handled Target',
            description: `This destination was preloaded via dynamic DOM mutation or batch queue testing (${cleanPath}).`,
            reqUrl: req.url,
        })
        res.writeHead(200, headers)
        res.end(content)
        return
    }

    const baseName = pathString.split('/').pop()
    if (['flashpage.js', 'flashpage.min.js', 'flashpage.lite.js', 'flashpage.lite.min.js', 'instantpage.js'].includes(baseName)) {
        headers['Content-Type'] = 'text/javascript'
        const targetPath = new URL(`../${baseName === 'instantpage.js' ? 'flashpage.js' : baseName}`, import.meta.url)
        content = await fs.readFile(targetPath)
        res.writeHead(200, headers)
        res.end(content)
        return
    }
    else if (['click-test.js', 'form-options.js', 'check-content-blocking.js', 'check-prefetch-effect.js'].includes(pathString)) {
        headers['Content-Type'] = 'text/javascript'
        const path = new URL(`client/${pathString}`, import.meta.url)
        content = await fs.readFile(path)
    }
    else if (pathString == 'favicon.ico') {
        headers['Content-Type'] = 'image/svg+xml'
        const faviconPath = new URL('client/favicon.svg', import.meta.url)
        content = await fs.readFile(faviconPath)
    }
    else if (pathString.startsWith('tests/')) {
        return automatedTests.servePage(req, res)
    }
    else if (!isNaN(page)) {
        await sleep(SLEEP_TIME)

        if (CACHE_MAX_AGE) {
            headers['Cache-Control'] = `max-age=${CACHE_MAX_AGE}`
        }

        if (VARY_ACCEPT != 'Off') {
            headers['Vary'] = 'Accept'
        }

        const headerPath = new URL('client/header.html', import.meta.url)
        const headerTemplate = await fs.readFile(headerPath, {encoding: 'utf8'})
        const header = await fillHeaderWithTests(headerTemplate)
        content += header

        const stylesheetPath = new URL('client/stylesheet.css', import.meta.url)
        const stylesheet = await fs.readFile(stylesheetPath, {encoding: 'utf-8'})
        content = content.replace('<link rel="stylesheet" href="-">', `<style>\n${stylesheet.trim()}\n</style>`)

        if (ALLOW_QUERY_STRING_AND_EXTERNAL_LINKS) {
            content = content.replace('<body>', '<body data-instant-allow-query-string data-instant-allow-external-links>')
        }

        if (USE_WHITELIST) {
            content = content.replace('<body', '<body data-instant-whitelist')
        }

        if (INTENSITY != 65) {
            content = content.replace('<body', `<body data-instant-intensity="${INTENSITY}"`)
        }
        const dataInstantAttribute = !ALLOW_QUERY_STRING_AND_EXTERNAL_LINKS || USE_WHITELIST ? `data-instant` : ``

        if (VARY_ACCEPT == 'On') {
            content = content.replace('<body', '<body data-instant-vary-accept')
        }
        if (VARY_ACCEPT == 'Simulate Shopify') {
            content = content.replace(/<body[^>]*>/, '$&\n<script>Shopify = {}</script>')
        }

        content = content.replace(':checked_aqsael', ALLOW_QUERY_STRING_AND_EXTERNAL_LINKS ? 'checked' : '')
        content = content.replace(':checked_whitelist', USE_WHITELIST ? 'checked' : '')
        content = content.replace(':value_sleep', `value="${SLEEP_TIME}"`)
        content = content.replace(':value_cacheAge', `value="${CACHE_MAX_AGE}"`)
        content = content.replace(':value_intensity', `value="${INTENSITY}"`)
        content = content.replace(':checked_minified', USE_MINIFIED ? 'checked' : '')
        content = content.replace(/ :vary_accept_([a-z_]+)/g, (match, p1) => {
            if (p1 == VARY_ACCEPT.toLowerCase().replace(' ', '_')) {
                return ' selected'
            }
            return ''
        })

        const matches = content.match(/<body([^>]*)>/)
        const openingBodyTagEscaped = matches[1].replace('<', '&lt;').replace('>', '&gt;')
        content = content.replace('<inspag-body>', `<inspag-body>${openingBodyTagEscaped}`)
        if (VARY_ACCEPT == 'Simulate Shopify') {
            content = content.replace('</inspag-body>', ' (window.Shopify)</inspag-body>')
        }

        content += `<h1>Page ${page}</h1>`
        for (let i = 1; i <= 3; i++) {
            if (page != i) {
                content += makeAnchorElement(`Page ${i}`, `<a href="/${i}?${getRandomId()}" ${dataInstantAttribute}>`)
            }
        }

        content += makeAnchorElement('Opens in a new tab', `<a href="/${page}?${getRandomId()}" target="_blank" ${dataInstantAttribute}>`)
        content += makeAnchorElement('Other page anchor', `<a href="/${page}?${getRandomId()}#anchor" ${dataInstantAttribute}>`)
        content += makeAnchorElement('Same-page anchor', `<a href="${req.url}#anchor" id="anchor">`)
        content += makeAnchorElement('Manually blacklisted link', `<a href="/${page}?${getRandomId()}" data-no-instant>`)
        content += makeAnchorElement('Non-whitelisted link', `<a href="/${page}?${getRandomId()}">`)
        content += makeAnchorElement('Query string', `<a href="/${page}?${getRandomId()}">`)
        content += makeAnchorElement('External link', `<a href="https://www.google.com/">`)
        content += makeAnchorElement('External link data-instant', `<a href="https://www.google.com/" data-instant>`)
        content += makeAnchorElement('&lt;a&gt; without <code>href</code>', `<a>`)
        content += makeAnchorElement('file: link', `<a href="file:///C:/">`)

        const footerPath = new URL('client/footer.html', import.meta.url)
        let footer = await fs.readFile(footerPath)
        footer = footer.toString().replace('__HASH__', jsHash)
        content += footer
    }

    res.writeHead(200, headers)
    res.write(content)
    res.end()
}

function handleCookies(req) {
    const cookies = req.headers.cookie

    if (!cookies) {
        return
    }

    cookies.split('; ').map((cookie) => {
        const [key, value] = cookie.split('=')

        if (key != 'instantpage_test') {
            return
        }

        const cookieValueSplit = value.split(',').map((param) => parseInt(param))
        ALLOW_QUERY_STRING_AND_EXTERNAL_LINKS = cookieValueSplit[0]
        SLEEP_TIME = cookieValueSplit[1]
        CACHE_MAX_AGE = cookieValueSplit[2]
        USE_WHITELIST = cookieValueSplit[3]
        INTENSITY = cookieValueSplit[4]
        if (isNaN(INTENSITY)) {
            INTENSITY = value.split(',')[4]
        }
        USE_MINIFIED = cookieValueSplit[5]
        if (value.split(',')[6]) {
            VARY_ACCEPT = value.split(',')[6]
        }
    })
}

function sha384(data) {
    const hash = crypto.createHash('sha384')
    hash.update(data)
    return hash.digest('base64')
}

function getRandomId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID().split('-')[0]
    }
    return Math.random().toString(36).substring(2, 10)
}

function makeAnchorElement(text, openingTag) {
    return `
    ${openingTag}
      <span>
        ${text}
        <small>${escapeHTMLTags(openingTag)}</small>
      </span>
    </a>
  `
}

function escapeHTMLTags(html) {
    const escaped = html
        .replace('<', '&lt;')
        .replace('>', '&gt;')
    return escaped
}

async function fillHeaderWithTests(header) {
    const tests = []
    const path = new URL('tests', import.meta.url)
    const dir = await fs.readdir(path)
    for (const testDir of dir) {
        if (testDir == '_template') {
            continue
        }

        const path = new URL(`tests/${testDir}/config.js`, import.meta.url)

        let testConfig
        try {
            testConfig = await import(path)
        }
        catch (e) {
            console.log(e.message)
            continue
        }

        tests.push({testDir, ...testConfig})
    }

    let testsHtml = tests.map((value) => `<a href="/tests/${value.testDir}/index.html" data-no-instant>${value.title}</a>`).join('\n')
    header = header.replace('<nav-content></nav-content>', testsHtml)

    return header
}

function renderDestinationPage({ title, icon, badgeClass, badgeText, description, reqUrl }) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Flash Page Verification</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">
  <style>
    body {
      background: #090d16;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
      margin: 0;
    }
    .card {
      max-width: 650px;
      width: 100%;
      background: rgba(22, 30, 46, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
    }
    h1 { font-size: 22px; margin-bottom: 12px; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 20px; font-size: 14px; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      font-family: ui-monospace, monospace;
      margin-bottom: 20px;
    }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .timing-box {
      background: #040711;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-size: 12px;
      margin-bottom: 24px;
      line-height: 1.9;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #38bdf8;
      color: #040711;
      font-weight: 600;
      font-size: 13px;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.15s;
    }
    a.btn:hover { background: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span>${icon}</span> ${title}</h1>
    <div class="badge ${badgeClass}">${badgeText}</div>
    <p>${description}</p>
    <div class="timing-box">
      <div>Requested URL: <span style="color:#7dd3fc;">${reqUrl}</span></div>
      <div>Transfer Size: <span id="transfer-type" style="color:#38bdf8;">Measuring...</span></div>
      <div>Total Duration: <span id="nav-duration" style="color:#10b981;">Measuring...</span></div>
      <div>DOM Interactive: <span id="dom-time" style="color:#f1f5f9;">Measuring...</span></div>
    </div>
    <a href="/live" class="btn">← Back to Live Workbench</a>
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0]
        if (nav) {
          const duration = Math.round(nav.duration)
          const transfer = nav.transferSize === 0
            ? '0 bytes (Served from Speculation/Browser Memory Cache! ⚡)'
            : (nav.transferSize + ' bytes (Standard Network Fetch)')
          document.getElementById('transfer-type').textContent = transfer
          document.getElementById('nav-duration').textContent = duration + ' ms'
          document.getElementById('dom-time').textContent = Math.round(nav.domInteractive - nav.startTime) + ' ms'
        }
      }, 50)
    })
  </script>
</body>
</html>`
}
