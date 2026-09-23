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

export function recordInitiatedPreload(url) {
    try {
        const raw = sessionStorage.getItem('flash_preloads')
        const list = raw ? JSON.parse(raw) : []
        list.push({ url, time: Date.now() })
        if (list.length > 20) list.shift()
        sessionStorage.setItem('flash_preloads', JSON.stringify(list))
    } catch {}
}

