/*!
 * Flash Page v1.2.0
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

import { isPreloadable, isUrlPreloadable, getAnchorHref, isolateHeatmaps } from './guards.js'
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
import { extractSubresources, prewarmSubresources, resetSubresources, extractExternalOrigins, preconnectOrigins } from './subresources.js'
import { toggleHUD, updateHUD, highlightPreloadedAnchor, resetHUD } from './hud.js'
import { initTelemetry, recordInitiatedPreload, getMetrics, resetTelemetry } from './telemetry.js'
import { useFlashPage, vFlash, useFlash, flashAction, setupAstroTransitions, createFlashLink, FlashLink } from './framework-utils.js'

let _isInitialized = false
let _abortController = null

// Re-export public APIs
export {
    isPreloadable,
    isUrlPreloadable,
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
    extractExternalOrigins,
    preconnectOrigins,
    recordTransition,
    predictNextLink,
    toggleHUD,
    getMetrics,
    useFlashPage,
    useFlash,
    flashAction,
    setupAstroTransitions,
    createFlashLink,
    FlashLink,
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
    if (_isInitialized) {
        if (customConfig && typeof customConfig === 'object' && Object.keys(customConfig).length > 0) {
            setConfig(customConfig)
        }
        return
    }

    // Merge dataset attributes from document.body/currentScript and global window.flashPageConfig
    const datasetConfig = typeof document !== 'undefined' ? parseDatasetConfig() : {}
    const globalConfig = (typeof window !== 'undefined' && window.flashPageConfig && typeof window.flashPageConfig === 'object') ? window.flashPageConfig : {}
    setConfig({ ...datasetConfig, ...globalConfig, ...customConfig })

    if (typeof window === 'undefined' || typeof document === 'undefined') return

    if (!isEnvironmentEligible()) {
        logDebug('Flash Page aborted: Environment not eligible (Data Saver, slow connection, or battery constraint).')
        return
    }

    _isInitialized = true
    _abortController = new AbortController()
    const { signal } = _abortController

    setupEngine()
    isolateHeatmaps()
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
    logDebug('Flash Page v1.2.0 initialized with engine:', getEngine())
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
    resetSubresources()

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
    if (!isUrlPreloadable(url)) return

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
        effectiveConcurrency: queue.effectiveConcurrency,
        isHealthy: isServerHealthy(),
        backpressureUntil: getBackpressureUntil(),
        config: { ...getConfig() },
    }
}

