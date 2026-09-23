/*! Flash Page Lite v1.0.0 | GPL-3.0-or-later */

const DEFAULT_CONFIG = {
    intensity: 65,
    delayOnHover: 65,
    allowQueryString: false,
    allowExternalLinks: false,
    whitelist: false,
    specrules: 'prefetch', // 'prerender' | 'prefetch' | 'no'
    predictive: false,
    respectDataSaver: true,
    respectBattery: true,
    safariFallback: true,
    maxConcurrent: 3,
    debug: false,
    hud: false,
    subresources: false,
    markov: true,
    backpressure: true,
    intentCone: true,
    filter: null,
    onPreload: null,
    onMetric: null,
}

let _config = { ...DEFAULT_CONFIG }
let _backpressureUntil = 0
let _cachedBattery = null

function getConfig() {
    return _config
}

function setConfig(newConfig) {
    _config = { ..._config, ...newConfig }
    if (typeof newConfig.intensity === 'number' && !('delayOnHover' in newConfig)) {
        _config.delayOnHover = newConfig.intensity
    }
}

function resetConfig() {
    _config = { ...DEFAULT_CONFIG }
    _backpressureUntil = 0
}

function setBackpressure(retryAfterSeconds = 30) {
    _backpressureUntil = Date.now() + retryAfterSeconds * 1000
}

function getBackpressureUntil() {
    return _backpressureUntil
}

function isServerHealthy() {
    if (!_config.backpressure) return true
    return Date.now() > _backpressureUntil
}

function setCachedBattery(bat) {
    _cachedBattery = bat
}

function parseDatasetConfig(targetDataset) {
    const d = targetDataset || (typeof document !== 'undefined' && document.body ? document.body.dataset : {})
    const parsed = {}

    // 1. Intensity & Hover Delay
    const intensityVal = d.flashIntensity !== undefined ? d.flashIntensity : d.instantIntensity
    if (intensityVal !== undefined) {
        parsed.intensity = intensityVal
        const asInt = parseInt(parsed.intensity, 10)
        if (!isNaN(asInt)) {
            parsed.delayOnHover = asInt
        }
    }
    if ('flashDelayOnHover' in d) {
        const delay = parseInt(d.flashDelayOnHover, 10)
        if (!isNaN(delay)) {
            parsed.delayOnHover = delay
        }
    }

    // 2. Query String & Cross-Origin
    if ('flashAllowQueryString' in d || 'instantAllowQueryString' in d) parsed.allowQueryString = true
    if ('flashAllowExternalLinks' in d || 'instantAllowExternalLinks' in d) parsed.allowExternalLinks = true

    // 3. Whitelist Mode
    if ('flashWhitelist' in d || 'instantWhitelist' in d) parsed.whitelist = true

    // 4. Speculation Rules Mode ('prefetch' | 'prerender' | 'no')
    if ('flashSpecrules' in d) {
        parsed.specrules = d.flashSpecrules
    }

    // 5. Predictive Trajectory & Intent Cone
    if ('flashPredictive' in d) parsed.predictive = true
    if ('flashNoIntentCone' in d) parsed.intentCone = false

    // 6. Device & Network Guards
    if ('flashNoDataSaver' in d) parsed.respectDataSaver = false
    if ('flashNoBattery' in d) parsed.respectBattery = false

    // 7. Safari / WebKit Fallback
    if ('flashNoSafariFallback' in d) parsed.safariFallback = false

    // 8. Max Concurrent Connections
    if ('flashMaxConcurrent' in d) {
        const max = parseInt(d.flashMaxConcurrent, 10)
        if (!isNaN(max) && max > 0) {
            parsed.maxConcurrent = max
        }
    }

    // 9. Debug & HUD
    if ('flashDebug' in d) parsed.debug = true
    if ('flashHud' in d) parsed.hud = true

    // 10. Subresource Warming
    if ('flashSubresources' in d) parsed.subresources = true

    // 11. Markov Predictive AI
    if ('flashNoMarkov' in d) parsed.markov = false

    // 12. Server Backpressure
    if ('flashNoBackpressure' in d) parsed.backpressure = false

    return parsed
}

function isEnvironmentEligible() {
    // 1. Server Backpressure check
    if (!isServerHealthy()) {
        logDebug('Server backpressure active. Preloading suspended.')
        return false
    }

    // 2. Data Saver & Slow 2G check
    if (_config.respectDataSaver) {
        const conn = typeof navigator !== 'undefined' ? navigator.connection : null
        if (conn) {
            if (conn.saveData) return false
            if (conn.effectiveType && conn.effectiveType.includes('2g')) return false
        }
    }

    // 3. Battery Check
    if (_config.respectBattery && _cachedBattery) {
        if (_cachedBattery.level < 0.20 && !_cachedBattery.charging) {
            return false
        }
    }

    // 4. Low Memory Check (devices with <= 1GB memory)
    if (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 1) {
        return false
    }

    return true
}

function logDebug(...args) {
    if (_config.debug) {
        console.log('[Flash Page]', ...args)
    }
}

function getAnchorHref(anchor) {
    if (!anchor) return null
    if (typeof anchor.href === 'string') return anchor.href
    if (anchor.href && typeof anchor.href.baseVal === 'string') return anchor.href.baseVal
    if (typeof anchor.getAttribute === 'function') return anchor.getAttribute('href')
    return null
}

function isPreloadable(anchor) {
    if (!anchor) return false

    // Server health check
    if (!isServerHealthy()) return false

    // Normalize raw href from HTMLAnchorElement, SVGAElement, or generic element
    const rawHref = getAnchorHref(anchor)
    if (!rawHref || typeof rawHref !== 'string' || !rawHref.trim()) return false

    // Parse URL safely with current location
    const loc = typeof location !== 'undefined' ? location : null
    let urlObj
    try {
        urlObj = new URL(rawHref.trim(), loc ? loc.href : undefined)
    } catch {
        return false
    }

    // Reject preloading the exact current page
    if (loc && urlObj.href === loc.href) {
        return false
    }

    const config = getConfig()
    const ds = anchor.dataset || {}

    const isMarkedAllow = 'flash' in ds || 'instant' in ds
    const isMarkedDisallow = 'noFlash' in ds || 'noInstant' in ds

    // Whitelist check
    if (config.whitelist && !isMarkedAllow) {
        return false
    }

    // Blacklist check
    if (isMarkedDisallow) {
        return false
    }

    // Download attribute check
    if (typeof anchor.hasAttribute === 'function' && anchor.hasAttribute('download')) {
        return false
    }

    // Target attribute check (e.g. target="_blank")
    if (anchor.target && anchor.target !== '_self') {
        return false
    }

    // Rel check: nofollow
    if (anchor.relList && typeof anchor.relList.contains === 'function' && anchor.relList.contains('nofollow')) {
        return false
    }

    // Action links check (Rails, Turbo, HTMX)
    if (typeof anchor.hasAttribute === 'function') {
        if (anchor.hasAttribute('data-method') ||
                anchor.hasAttribute('data-turbo-method') ||
                anchor.hasAttribute('hx-post') ||
                anchor.hasAttribute('hx-delete')) {
            return false
        }
    }

    // Origin check
    if (loc && urlObj.origin !== loc.origin) {
        const allowed = config.allowExternalLinks || isMarkedAllow
        if (!allowed) return false
    }

    // Protocol check
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false
    if (loc && urlObj.protocol === 'http:' && loc.protocol === 'https:') return false

    // Query string check
    if (!config.allowQueryString && urlObj.search && !isMarkedAllow) {
        return false
    }

    // Same-page hash anchor check
    if (loc && urlObj.hash && (urlObj.pathname + urlObj.search === loc.pathname + loc.search)) {
        return false
    }

    // Action path check (sensitive endpoints)
    const path = urlObj.pathname.toLowerCase()
    if (path.includes('/logout') || path.includes('/signout') || path.includes('/delete') || path.includes('/destroy') || path.includes('/remove')) {
        return false
    }

    // Custom user filter callback
    if (typeof config.filter === 'function') {
        try {
            if (!config.filter(urlObj, anchor)) return false
        } catch {
            return false
        }
    }

    return true
}

let _speculationMode = 'none' // 'document-rules' | 'speculation-list' | 'link' | 'fetch'

function getEngine() {
    return _speculationMode
}

function resetEngine() {
    _speculationMode = 'none'
    if (typeof document !== 'undefined') {
        const injectedRules = document.querySelectorAll('script[data-flash-rules]')
        injectedRules.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el)
        })
        const injectedLinks = document.querySelectorAll('link[data-flash-link]')
        injectedLinks.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el)
        })
    }
}

function setupEngine() {
    const config = getConfig()

    const supportsSpeculationRules = typeof HTMLScriptElement !== 'undefined' &&
        HTMLScriptElement.supports &&
        HTMLScriptElement.supports('speculationrules')

    const supportsPrefetchRel = typeof document !== 'undefined' &&
        document.createElement('link').relList &&
        document.createElement('link').relList.supports &&
        document.createElement('link').relList.supports('prefetch')

    if (supportsSpeculationRules && config.specrules !== 'no') {
        const injected = setupDocumentSpeculationRules()
        if (injected) {
            _speculationMode = 'document-rules'
            return _speculationMode
        }
        _speculationMode = 'speculation-list'
    } else if (supportsPrefetchRel) {
        _speculationMode = 'link'
    } else if (config.safariFallback && typeof fetch === 'function') {
        _speculationMode = 'fetch'
    } else {
        _speculationMode = 'none'
    }

    return _speculationMode
}

function setupDocumentSpeculationRules() {
    try {
        const config = getConfig()
        const script = document.createElement('script')
        script.type = 'speculationrules'
        script.setAttribute('data-flash-rules', '')

        const action = config.specrules === 'prerender' ? 'prerender' : 'prefetch'
        const eagerness = config.intensity === 'mousedown' || config.intensity === 'mousedown-only'
            ? 'conservative'
            : 'moderate'

        const documentRule = {
            [action]: [
                {
                    source: 'document',
                    where: {
                        and: [
                            { href_matches: '/*' },
                            {
                                not: {
                                    selector_matches: [
                                        '[data-no-flash]',
                                        '[data-no-instant]',
                                        '[download]',
                                        '[target="_blank"]',
                                        '[rel~="nofollow"]',
                                        '[data-method]',
                                        '[data-turbo-method]',
                                        '[hx-post]',
                                        '[hx-delete]',
                                        '[href*="/logout"]',
                                        '[href*="/signout"]',
                                        '[href*="/delete"]',
                                        '[href*="/destroy"]',
                                        '[href*="/remove"]',
                                    ].join(', ')
                                }
                            }
                        ]
                    },
                    eagerness,
                }
            ]
        }

        script.textContent = JSON.stringify(documentRule)
        const target = document.head || document.documentElement
        if (target) target.appendChild(script)
        return true
    } catch (err) {
        logDebug('Document Rules injection failed, falling back to dynamic list:', err)
        return false
    }
}

function preloadUsingSpeculationList(url, type) {
    const script = document.createElement('script')
    script.type = 'speculationrules'
    script.setAttribute('data-flash-rules', '')
    script.textContent = JSON.stringify({
        [type]: [{
            source: 'list',
            urls: [url]
        }]
    })
    const target = document.head || document.documentElement
    if (target) target.appendChild(script)
    return new Promise(resolve => setTimeout(resolve, 400))
}

function preloadUsingLink(url, priority = 'auto') {
    return new Promise((resolve) => {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = url
        link.as = 'document'
        link.setAttribute('data-flash-link', '')
        if (priority !== 'auto') {
            link.fetchPriority = priority
        }
        let settled = false
        const done = () => {
            if (!settled) {
                settled = true
                resolve()
            }
        }
        link.addEventListener('load', done, { once: true })
        link.addEventListener('error', done, { once: true })
        setTimeout(done, 500)
        const target = document.head || document.documentElement
        if (target) target.appendChild(link)
    })
}

async function preloadUsingFetch(url) {
    try {
        const res = await fetch(url, {
            priority: 'low',
            credentials: 'same-origin',
            headers: { 'Purpose': 'prefetch' }
        })

        const config = getConfig()
        // Backpressure handling (429 Too Many Requests or 503 Service Unavailable)
        if (config.backpressure && (res.status === 429 || res.status === 503)) {
            const retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 30
            setBackpressure(retryAfter)
            logDebug(`Server 429/503 received. Backing off prefetch for ${retryAfter}s`)
        }

        return res
    } catch (err) {
        return null
    }
}

let _preloadedUrls = new Set()
let _inflightCount = 0
let _prefetchQueue = []
let _listeners = []

function getQueueStatus() {
    return {
        preloadedCount: _preloadedUrls.size,
        inflightCount: _inflightCount,
        queueLength: _prefetchQueue.length,
        preloadedUrls: _preloadedUrls,
    }
}

function resetQueue() {
    _prefetchQueue = []
    _preloadedUrls.clear()
    _inflightCount = 0
    _listeners = []
}

function onQueueChange(fn) {
    _listeners.push(fn)
}

function notifyListeners() {
    _listeners.forEach(fn => {
        try { fn() } catch {}
    })
}

function hasPreloaded(url) {
    return _preloadedUrls.has(url)
}

function enqueuePrefetch(url, priority, onSubresources) {
    _preloadedUrls.add(url)
    _prefetchQueue.push({ url, priority, onSubresources })
    notifyListeners()
    processQueue()
}

function processQueue() {
    const config = getConfig()
    while (_inflightCount < config.maxConcurrent && _prefetchQueue.length > 0) {
        const { url, priority, onSubresources } = _prefetchQueue.shift()
        _inflightCount++
        notifyListeners()

        executePreload(url, priority, onSubresources).finally(() => {
            _inflightCount--
            notifyListeners()
            processQueue()
        })
    }
}

async function executePreload(url, priority, onSubresources) {
    let mode = getEngine()
    if (mode === 'none') {
        mode = setupEngine()
    }
    const config = getConfig()
    logDebug(`[${mode}] Preloading: ${url} (priority: ${priority})`)

    try {
        let responseText = null

        if (typeof config.onPreload === 'function') {
            config.onPreload(url, mode)
        }

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            try {
                window.dispatchEvent(new CustomEvent('flash:preload', { detail: { url, engine: mode } }))
            } catch {}
        }

        if (mode === 'document-rules') {
            await preloadUsingSpeculationList(url, config.specrules === 'prerender' ? 'prerender' : 'prefetch')
        } else if (mode === 'speculation-list') {
            await preloadUsingSpeculationList(url, config.specrules === 'prerender' ? 'prerender' : 'prefetch')
        } else if (mode === 'link') {
            await preloadUsingLink(url, priority)
        } else if (mode === 'fetch') {
            const res = await preloadUsingFetch(url)
            if (res && res.text) {
                responseText = await res.text()
            }
        }

        if (config.subresources && responseText && typeof onSubresources === 'function') {
            onSubresources(responseText)
        }
    } catch (err) {
        logDebug('Preload failed for:', url, err)
    }
}

let _hoverTimer = null
let _currentHoverAnchor = null
let _lastPointerX = 0
let _lastPointerY = 0
let _lastPointerTime = 0
let _isRapidScrolling = false
let _scrollTimeout = null

function isRapidScrolling() {
    return _isRapidScrolling
}

function resetInputState() {
    if (_hoverTimer) {
        clearTimeout(_hoverTimer)
        _hoverTimer = null
    }
    if (_scrollTimeout) {
        clearTimeout(_scrollTimeout)
        _scrollTimeout = null
    }
    _currentHoverAnchor = null
    _isRapidScrolling = false
}

function setupEventListeners(signal, onPreloadRequest, onToggleHUD) {
    const config = getConfig()
    const isMousedownOnly = config.intensity === 'mousedown-only'
    const isMousedown = config.intensity === 'mousedown'
    const isViewport = config.intensity === 'viewport' || config.intensity === 'viewport-all'

    // Monitor battery changes asynchronously if supported
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator && typeof navigator.getBattery === 'function') {
        navigator.getBattery().then(bat => {
            setCachedBattery(bat)
            bat.addEventListener('levelchange', () => { setCachedBattery(bat) }, { signal })
            bat.addEventListener('chargingchange', () => { setCachedBattery(bat) }, { signal })
        }).catch(() => {})
    }

    // 1. Keyboard Shortcut for DevTools HUD (Ctrl + Shift + F or Cmd + Shift + F)
    if (typeof onToggleHUD === 'function') {
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
                event.preventDefault()
                onToggleHUD()
            }
        }, { signal })
    }

    // 2. Pointer Down (Mobile touch tap & Desktop click start)
    document.addEventListener('pointerdown', (event) => {
        const anchor = event.target && event.target.closest ? event.target.closest('a') : null
        if (isPreloadable(anchor)) {
            const href = getAnchorHref(anchor)
            if (href) onPreloadRequest(href, 'high')
        }
    }, { capture: true, passive: true, signal })

    // 3. Pointer Over (Desktop mouse hover)
    if (!isMousedownOnly) {
        document.addEventListener('pointerover', (event) => {
            if (event.pointerType !== 'mouse') return

            const anchor = event.target && event.target.closest ? event.target.closest('a') : null
            if (!anchor || anchor === _currentHoverAnchor || !isPreloadable(anchor)) return

            _currentHoverAnchor = anchor

            const onLeave = (e) => {
                if (e.relatedTarget && anchor.contains(e.relatedTarget)) {
                    return
                }
                if (_hoverTimer) {
                    clearTimeout(_hoverTimer)
                    _hoverTimer = null
                }
                _currentHoverAnchor = null
                anchor.removeEventListener('pointerout', onLeave)
            }
            anchor.addEventListener('pointerout', onLeave, { passive: true })

            if (isMousedown) return

            let delay = config.delayOnHover
            if (anchor.dataset) {
                if (anchor.dataset.flashIntensity) {
                    const parsed = parseInt(anchor.dataset.flashIntensity, 10)
                    if (!isNaN(parsed)) delay = parsed
                } else if (anchor.dataset.instantIntensity) {
                    const parsed = parseInt(anchor.dataset.instantIntensity, 10)
                    if (!isNaN(parsed)) delay = parsed
                }
            }

            _hoverTimer = setTimeout(() => {
                const href = getAnchorHref(anchor)
                if (href) onPreloadRequest(href, 'high')
                _hoverTimer = null
            }, delay)
        }, { capture: true, passive: true, signal })
    }

    // 4. Predictive Cursor Trajectory with Intent Cone
    if (config.predictive || config.intensity === 'predictive') {
        document.addEventListener('pointermove', (e) => onPointerMoveTrajectory(e, onPreloadRequest), { passive: true, signal })
    }

    // 5. Scroll Acceleration Detection for Viewport Mode
    if (isViewport) {
        window.addEventListener('scroll', () => {
            _isRapidScrolling = true
            if (_scrollTimeout) clearTimeout(_scrollTimeout)
            _scrollTimeout = setTimeout(() => {
                _isRapidScrolling = false
            }, 150)
        }, { passive: true, signal })
    }
}

function onPointerMoveTrajectory(event, onPreloadRequest) {
    if (event.pointerType !== 'mouse') return

    const now = performance.now()
    const dt = now - _lastPointerTime
    if (dt < 25) return // Throttle trajectory calculation to ~40Hz

    const vx = (event.clientX - _lastPointerX) / dt
    const vy = (event.clientY - _lastPointerY) / dt
    _lastPointerX = event.clientX
    _lastPointerY = event.clientY
    _lastPointerTime = now

    const speedSq = vx * vx + vy * vy
    if (speedSq < 0.1 || speedSq > 15) return // Ignore stationary or violent flicks

    const config = getConfig()
    const projDist = 120
    const testPoints = [
        { x: Math.round(event.clientX + vx * projDist), y: Math.round(event.clientY + vy * projDist) }
    ]

    if (config.intentCone) {
        const len = Math.sqrt(speedSq)
        const nx = -vy / len
        const ny = vx / len
        const spread = 25
        testPoints.push(
            { x: Math.round(event.clientX + vx * projDist + nx * spread), y: Math.round(event.clientY + vy * projDist + ny * spread) },
            { x: Math.round(event.clientX + vx * projDist - nx * spread), y: Math.round(event.clientY + vy * projDist - ny * spread) }
        )
    }

    for (const pt of testPoints) {
        if (pt.x < 0 || pt.x > window.innerWidth || pt.y < 0 || pt.y > window.innerHeight) continue
        const element = document.elementFromPoint(pt.x, pt.y)
        const anchor = element && element.closest ? element.closest('a') : null
        if (isPreloadable(anchor)) {
            const href = getAnchorHref(anchor)
            if (href) onPreloadRequest(href, 'low')
            break
        }
    }
}

let _intersectionObserver = null
let _mutationObserver = null

function resetViewportObservers() {
    if (_intersectionObserver) {
        _intersectionObserver.disconnect()
        _intersectionObserver = null
    }
    if (_mutationObserver) {
        _mutationObserver.disconnect()
        _mutationObserver = null
    }
}

function setupViewportAndDynamicObserver(signal, onPreloadRequest) {
    const config = getConfig()
    const isViewport = config.intensity === 'viewport' || config.intensity === 'viewport-all'
    if (!isViewport) return

    if (config.intensity === 'viewport') {
        const isSmallScreen = (document.documentElement.clientWidth * document.documentElement.clientHeight) < 450000
        if (!isSmallScreen) return
    }

    const requestIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))

    requestIdle(() => {
        if (signal && signal.aborted) return

        _intersectionObserver = new IntersectionObserver((entries) => {
            if (isRapidScrolling()) return

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const anchor = entry.target
                    if (_intersectionObserver) _intersectionObserver.unobserve(anchor)
                    const href = getAnchorHref(anchor)
                    if (href) onPreloadRequest(href, 'auto')
                }
            })
        }, { rootMargin: '200px' })

        // Observe initial links
        document.querySelectorAll('a').forEach((anchor) => {
            if (isPreloadable(anchor)) _intersectionObserver.observe(anchor)
        })

        // Dynamic SPA & Infinite Scroll observation
        _mutationObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue
                    const anchors = node.matches && node.matches('a') ? [node] : (node.querySelectorAll ? node.querySelectorAll('a') : [])
                    anchors.forEach((a) => {
                        if (isPreloadable(a) && _intersectionObserver) {
                            _intersectionObserver.observe(a)
                        }
                    })
                }
            }
        })

        const bodyTarget = document.body || document.documentElement
        if (bodyTarget) {
            _mutationObserver.observe(bodyTarget, { childList: true, subtree: true })
        }
    })
}

let _metricsHistory = []

function getMetrics() {
    return [..._metricsHistory]
}

function resetTelemetry() {
    _metricsHistory = []
}

function initTelemetry() {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return

    const navEntries = performance.getEntriesByType('navigation')
    if (!navEntries || navEntries.length === 0) return

    const nav = navEntries[0]
    const currentUrl = location.href

    try {
        const saved = sessionStorage.getItem('flash_preloads')
        if (saved) {
            const records = JSON.parse(saved)
            const hit = records.find(r => {
                if (!r || !r.url) return false
                if (r.url === currentUrl) return true
                try {
                    const u1 = new URL(r.url, location.href)
                    const u2 = new URL(currentUrl, location.href)
                    return u1.origin === u2.origin && u1.pathname === u2.pathname && u1.search === u2.search
                } catch {
                    return false
                }
            })

            const metric = {
                url: currentUrl,
                converted: Boolean(hit),
                transferSize: nav.transferSize || 0,
                duration: Math.round(nav.duration || 0),
                timestamp: Date.now(),
            }

            _metricsHistory.push(metric)

            const config = getConfig()
            if (typeof config.onMetric === 'function') {
                config.onMetric(metric)
            }

            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                try {
                    window.dispatchEvent(new CustomEvent('flash:metric', { detail: metric }))
                } catch {}
            }
            sessionStorage.removeItem('flash_preloads')
        }
    } catch {}
}

function recordInitiatedPreload(url) {
    try {
        const raw = sessionStorage.getItem('flash_preloads')
        const list = raw ? JSON.parse(raw) : []
        list.push({ url, time: Date.now() })
        if (list.length > 20) list.shift()
        sessionStorage.setItem('flash_preloads', JSON.stringify(list))
    } catch {}
}

let _isInitialized = false
let _abortController = null

export { isPreloadable, getAnchorHref, isServerHealthy, getMetrics }

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init()
    } else {
        document.addEventListener('DOMContentLoaded', () => init(), { once: true })
    }
}

export function init(customConfig = {}) {
    if (_isInitialized) return

    const datasetConfig = typeof document !== 'undefined' ? parseDatasetConfig() : {}
    setConfig({ ...datasetConfig, ...customConfig })

    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (!isEnvironmentEligible()) return

    _isInitialized = true
    _abortController = new AbortController()
    const { signal } = _abortController

    setupEngine()
    setupEventListeners(signal, onPreloadRequest)
    setupViewportAndDynamicObserver(signal, onPreloadRequest)
    initTelemetry()

    window.flashPage = {
        init,
        preload,
        destroy,
        getMetrics,
        status,
        config: getConfig(),
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        try {
            window.dispatchEvent(new CustomEvent('flash:ready', { detail: { status: status() } }))
        } catch {}
    }
}

export function destroy() {
    if (_abortController) {
        _abortController.abort()
        _abortController = null
    }

    resetInputState()
    resetViewportObservers()
    resetQueue()
    resetEngine()
    resetTelemetry()

    _isInitialized = false
    resetConfig()
}

export function preload(url, priority = 'auto') {
    if (!url || hasPreloaded(url)) return
    if (!isEnvironmentEligible()) return

    onPreloadRequest(url, priority)
}

function onPreloadRequest(url, priority = 'auto') {
    enqueuePrefetch(url, priority)
    recordInitiatedPreload(url)
}

export function status() {
    const queue = getQueueStatus()
    return {
        initialized: _isInitialized,
        engine: getEngine(),
        preloadedCount: queue.preloadedCount,
        inflightCount: queue.inflightCount,
        queueLength: queue.queueLength,
        isHealthy: isServerHealthy(),
        backpressureUntil: getBackpressureUntil(),
        config: { ...getConfig() },
    }
}
