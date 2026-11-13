/*! Flash Page: Configuration & Environment Guards */

export const DEFAULT_CONFIG = {
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
    nonce: null,
    adaptiveConcurrency: false,
    beaconUrl: null,
    analytics: null,
    isolateHeatmaps: true,
    cartSafeguards: true,
    priorityQueue: true,
    preconnectCdn: true,
}

let _config = { ...DEFAULT_CONFIG }
let _backpressureUntil = 0
let _cachedBattery = null

export function getConfig() {
    return _config
}

export function setConfig(newConfig) {
    _config = { ..._config, ...newConfig }
    if (typeof newConfig.intensity === 'number' && !('delayOnHover' in newConfig)) {
        _config.delayOnHover = newConfig.intensity
    }
}

export function resetConfig() {
    _config = { ...DEFAULT_CONFIG }
    _backpressureUntil = 0
}

export function setBackpressure(retryAfterSeconds = 30) {
    const sec = typeof retryAfterSeconds === 'number' && !isNaN(retryAfterSeconds)
        ? Math.min(retryAfterSeconds, 300)
        : 30
    _backpressureUntil = sec > 0 ? Date.now() + sec * 1000 : 0
}

export function getBackpressureUntil() {
    return _backpressureUntil
}

export function isServerHealthy() {
    if (!_config.backpressure) return true
    return Date.now() > _backpressureUntil
}

export function setCachedBattery(bat) {
    _cachedBattery = bat
}

export function parseDatasetConfig(targetDataset) {
    let d = {}
    if (targetDataset) {
        d = targetDataset
    } else if (typeof document !== 'undefined') {
        const bodyDs = document.body ? document.body.dataset : {}
        const scriptDs = (document.currentScript && document.currentScript.dataset) ? document.currentScript.dataset : {}
        d = { ...bodyDs, ...scriptDs }
    }
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

    // 13. CSP Nonce
    if ('flashNonce' in d) parsed.nonce = d.flashNonce
    if (!parsed.nonce && typeof document !== 'undefined' && document.currentScript) {
        if (document.currentScript.nonce) {
            parsed.nonce = document.currentScript.nonce
        } else if (document.currentScript.dataset && document.currentScript.dataset.flashNonce) {
            parsed.nonce = document.currentScript.dataset.flashNonce
        }
    }

    // 14. Adaptive Concurrency
    if ('flashAdaptiveConcurrency' in d) parsed.adaptiveConcurrency = true
    if ('flashNoAdaptiveConcurrency' in d) parsed.adaptiveConcurrency = false

    // 15. Telemetry Beacon URL (strictly validate http/https and prevent mixed content downgrade)
    if ('flashBeaconUrl' in d && d.flashBeaconUrl) {
        try {
            const loc = typeof location !== 'undefined' ? location : null
            const beaconUrlObj = new URL(d.flashBeaconUrl, loc ? loc.href : undefined)
            if (['http:', 'https:'].includes(beaconUrlObj.protocol)) {
                if (!(loc && loc.protocol === 'https:' && beaconUrlObj.protocol === 'http:')) {
                    parsed.beaconUrl = beaconUrlObj.href
                }
            }
        } catch {}
    }

    // 16. Analytics Exporter Mode
    if ('flashAnalytics' in d) parsed.analytics = d.flashAnalytics

    // 17. Heatmap & Session Replay Isolation
    if ('flashNoIsolateHeatmaps' in d) parsed.isolateHeatmaps = false

    // 18. E-Commerce Cart Safeguards
    if ('flashNoCartSafeguards' in d) parsed.cartSafeguards = false
    if ('flashCartSafeguards' in d) parsed.cartSafeguards = true

    // 19. Prioritized Queue Scheduling
    if ('flashNoPriorityQueue' in d) parsed.priorityQueue = false
    if ('flashPriorityQueue' in d) parsed.priorityQueue = true

    // 20. Subresource CDN Preconnect
    if ('flashNoPreconnectCdn' in d) parsed.preconnectCdn = false
    if ('flashPreconnectCdn' in d) parsed.preconnectCdn = true

    return parsed
}

export function isEnvironmentEligible() {
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
        if (typeof _cachedBattery.level === 'number' && _cachedBattery.level < 0.20 && !_cachedBattery.charging) {
            return false
        }
    }

    // 4. Low Memory Check (devices with <= 1GB memory)
    if (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 1) {
        return false
    }

    return true
}

export function logDebug(...args) {
    if (_config.debug) {
        console.log('[Flash Page]', ...args)
    }
}

