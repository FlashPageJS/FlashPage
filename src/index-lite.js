/*!
 * Flash Page Lite v1.0.0
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

import { isPreloadable, getAnchorHref } from './guards.js'
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

