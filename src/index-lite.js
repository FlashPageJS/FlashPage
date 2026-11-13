/*!
 * Flash Page Lite v1.2.0
 * Ultra-Lightweight Speculation Rules & Smart Prefetch
 * Copyright (C) 2026 Flash Page Contributors
 * Licensed under the GNU General Public License v3.0 (GPL-3.0-or-later)
 */

import {
    getConfig,
    setConfig,
    resetConfig,
    parseDatasetConfig,
    isEnvironmentEligible,
    isServerHealthy,
    getBackpressureUntil,
    logDebug,
} from './config.js'

import { isPreloadable, isUrlPreloadable, getAnchorHref, isolateHeatmaps } from './guards.js'
import { setupEngine, getEngine, resetEngine } from './engines.js'
import {
    enqueuePrefetch,
    getQueueStatus,
    hasPreloaded,
    resetQueue,
} from './queue.js'
import { setupEventListeners, resetInputState } from './input.js'
import { setupViewportAndDynamicObserver, resetViewportObservers } from './viewport.js'
import { initTelemetry, recordInitiatedPreload, getMetrics, resetTelemetry } from './telemetry.js'

let _isInitialized = false
let _abortController = null

export { isPreloadable, isUrlPreloadable, getAnchorHref, isServerHealthy, getMetrics }

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init()
    } else {
        document.addEventListener('DOMContentLoaded', () => init(), { once: true })
    }
}

export function init(customConfig = {}) {
    if (_isInitialized) {
        if (customConfig && typeof customConfig === 'object' && Object.keys(customConfig).length > 0) {
            setConfig(customConfig)
        }
        return
    }

    const datasetConfig = typeof document !== 'undefined' ? parseDatasetConfig() : {}
    const globalConfig = (typeof window !== 'undefined' && window.flashPageConfig && typeof window.flashPageConfig === 'object') ? window.flashPageConfig : {}
    setConfig({ ...datasetConfig, ...globalConfig, ...customConfig })

    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (!isEnvironmentEligible()) return

    _isInitialized = true
    _abortController = new AbortController()
    const { signal } = _abortController

    setupEngine()
    isolateHeatmaps()
    setupEventListeners(signal, onPreloadRequest)
    setupViewportAndDynamicObserver(signal, onPreloadRequest)
    initTelemetry()

    window.flashPage = {
        init,
        preload,
        destroy,
        getMetrics,
        status,
        isPreloadable,
        isUrlPreloadable,
        isServerHealthy,
        get config() { return getConfig() },
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
    if (!isUrlPreloadable(url)) return

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
        effectiveConcurrency: queue.effectiveConcurrency,
        isHealthy: isServerHealthy(),
        backpressureUntil: getBackpressureUntil(),
        config: { ...getConfig() },
    }
}

