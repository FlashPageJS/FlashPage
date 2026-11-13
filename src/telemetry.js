/*! Flash Page: Telemetry & Conversion Metrics */

import { getConfig } from './config.js'

let _metricsHistory = []

export function getMetrics() {
    return [..._metricsHistory]
}

export function resetTelemetry() {
    _metricsHistory = []
}

export function initTelemetry() {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return

    const navEntries = performance.getEntriesByType('navigation')
    if (!navEntries || navEntries.length === 0) return

    const nav = navEntries[0]
    const currentUrl = location.href

    try {
        const saved = sessionStorage.getItem('flash_preloads')
        if (saved) {
            let records = []
            try {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed)) records = parsed
            } catch {}
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

            const wasPrerendered = Boolean(
                (nav && typeof nav.activationStart === 'number' && nav.activationStart > 0) ||
                (typeof document !== 'undefined' && document.prerendering === false && nav && nav.activationStart > 0)
            )
            const activationStart = nav && typeof nav.activationStart === 'number' ? Math.round(nav.activationStart) : 0
            const lcpSavedMs = wasPrerendered
                ? Math.max(250, Math.round(nav.duration || 300))
                : (hit ? 150 : 0)

            const metric = {
                url: currentUrl,
                converted: Boolean(hit),
                transferSize: nav.transferSize || 0,
                duration: Math.round(nav.duration || 0),
                timestamp: Date.now(),
                wasPrerendered,
                activationStart,
                lcpSavedMs,
            }

            _metricsHistory.push(metric)

            const config = getConfig()
            if (typeof config.onMetric === 'function') {
                config.onMetric(metric)
            }

            dispatchExporters(metric, config)

            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                try {
                    window.dispatchEvent(new CustomEvent('flash:metric', { detail: metric }))
                } catch {}
            }
            sessionStorage.removeItem('flash_preloads')
        }
    } catch {}
}

export function dispatchExporters(metric, config = getConfig()) {
    if (!metric) return

    if (config.beaconUrl && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
            const loc = typeof location !== 'undefined' ? location.href : undefined
            const parsed = new URL(config.beaconUrl, loc)
            if (['http:', 'https:'].includes(parsed.protocol)) {
                navigator.sendBeacon(config.beaconUrl, JSON.stringify(metric))
            }
        } catch {}
    }

    if (typeof config.analytics === 'function') {
        try { config.analytics(metric) } catch {}
    } else if (config.analytics === 'ga4' && typeof window !== 'undefined' && typeof window.gtag === 'function') {
        try {
            window.gtag('event', 'flash_navigation', {
                page_location: metric.url,
                converted: metric.converted,
                was_prerendered: metric.wasPrerendered,
                lcp_saved_ms: metric.lcpSavedMs,
                value: metric.lcpSavedMs,
            })
        } catch {}
    } else if (config.analytics === 'datadog' && typeof window !== 'undefined' && window.DD_RUM && typeof window.DD_RUM.addAction === 'function') {
        try {
            window.DD_RUM.addAction('flash_navigation', metric)
        } catch {}
    } else if (config.analytics === 'sentry' && typeof window !== 'undefined' && window.Sentry && typeof window.Sentry.addBreadcrumb === 'function') {
        try {
            window.Sentry.addBreadcrumb({
                category: 'flash.navigation',
                message: `Flash navigation: ${metric.url} (prerendered: ${metric.wasPrerendered})`,
                data: metric,
                level: 'info'
            })
        } catch {}
    }
}

export function recordInitiatedPreload(url) {
    try {
        const raw = sessionStorage.getItem('flash_preloads')
        let list = []
        if (raw) {
            try {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) list = parsed
            } catch {}
        }
        list.push({ url, time: Date.now() })
        if (list.length > 20) list.shift()
        sessionStorage.setItem('flash_preloads', JSON.stringify(list))
    } catch {}
}

