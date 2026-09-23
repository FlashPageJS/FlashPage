/*!
 * Flash Page v1.0.0
 * Universal Speculation Rules & Smart Prefetch Manager
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
    setBackpressure,
    getBackpressureUntil,
    setCachedBattery,
    logDebug,
} from './config.js'

import { isPreloadable, getAnchorHref } from './guards.js'
import { setupEngine, getEngine, resetEngine } from './engines.js'
import {
    enqueuePrefetch,
    getQueueStatus,
    hasPreloaded,
    resetQueue,
    onQueueChange,
} from './queue.js'
import { setupEventListeners, resetInputState } from './input.js'
import { setupViewportAndDynamicObserver, resetViewportObservers } from './viewport.js'
import { initMarkovModel, recordTransition, predictNextLink } from './markov.js'
import { extractSubresources, prewarmSubresources } from './subresources.js'
import { toggleHUD, updateHUD, highlightPreloadedAnchor, resetHUD } from './hud.js'
import { initTelemetry, recordInitiatedPreload, getMetrics, resetTelemetry } from './telemetry.js'
import { useFlashPage, vFlash } from './framework-utils.js'

let _isInitialized = false
let _abortController = null

// Re-export public APIs
export {
    isPreloadable,
    getAnchorHref,
    isServerHealthy,
    isEnvironmentEligible,
    setBackpressure,
    getBackpressureUntil,
    setCachedBattery,
    getConfig,
    setConfig,
    resetConfig,
    extractSubresources,
    recordTransition,
    predictNextLink,
    toggleHUD,
    getMetrics,
    useFlashPage,
    vFlash,
}

// Check if running in browser script tag environment and auto-init
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init()
    } else {
        document.addEventListener('DOMContentLoaded', () => init(), { once: true })
    }
}

/**
 * Initializes Flash Page with optional configuration
 * @param {Partial<import('../flashpage.d.ts').FlashPageConfig>} [customConfig]
 */
export function init(customConfig = {}) {
    if (_isInitialized) return

    // Merge dataset attributes from document.body if in DOM
    const datasetConfig = typeof document !== 'undefined' ? parseDatasetConfig() : {}
    setConfig({ ...datasetConfig, ...customConfig })

    if (typeof window === 'undefined' || typeof document === 'undefined') return

    if (!isEnvironmentEligible()) {
        logDebug('Flash Page aborted: Environment not eligible (Data Saver, slow connection, or battery constraint).')
        return
    }

    _isInitialized = true
    _abortController = new AbortController()
    const { signal } = _abortController

    setupEngine()
    setupEventListeners(signal, onPreloadRequest, toggleHUD)
    setupViewportAndDynamicObserver(signal, onPreloadRequest)
    initTelemetry()
    initMarkovModel(onPreloadRequest)

    onQueueChange(() => updateHUD())

    const config = getConfig()
    if (config.hud) {
        toggleHUD(true)
    }

    // Global instance
    window.flashPage = {
        init,
        preload,
        destroy,
        getMetrics,
        status,
        toggleHUD,
        recordTransition,
        predictNextLink,
        config,
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        try {
            window.dispatchEvent(new CustomEvent('flash:ready', { detail: { status: status() } }))
        } catch {}
    }
    logDebug('Flash Page v1.0.0 initialized with engine:', getEngine())
}

/**
 * Cleanly destroys Flash Page: removes event listeners, disconnects observers, clears queues.
 */
export function destroy() {
    if (_abortController) {
        _abortController.abort()
        _abortController = null
    }

    resetInputState()
    resetViewportObservers()
    resetQueue()
    resetEngine()
    resetHUD()
    resetTelemetry()

    _isInitialized = false
    resetConfig()
    logDebug('Flash Page destroyed and cleaned up.')
}

/**
 * Programmatically preloads a URL
 * @param {string} url
 * @param {'auto' | 'high' | 'low'} [priority='auto']
 */
export function preload(url, priority = 'auto') {
    if (!url || hasPreloaded(url)) return
    if (!isEnvironmentEligible()) return

    onPreloadRequest(url, priority)
}

function onPreloadRequest(url, priority = 'auto') {
    enqueuePrefetch(url, priority, (htmlText) => {
        prewarmSubresources(htmlText)
    })
    recordInitiatedPreload(url)
    highlightPreloadedAnchor(url)
}

/**
 * Returns current status of Flash Page
 */
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

