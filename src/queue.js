/*! Flash Page: Concurrency Queue Manager */

import { getConfig, logDebug } from './config.js'
import { getEngine, setupEngine, preloadUsingSpeculationList, preloadUsingLink, preloadUsingFetch } from './engines.js'

let _preloadedUrls = new Set()
let _inflightCount = 0
let _prefetchQueue = []
let _listeners = []

export function getQueueStatus() {
    return {
        preloadedCount: _preloadedUrls.size,
        inflightCount: _inflightCount,
        queueLength: _prefetchQueue.length,
        preloadedUrls: _preloadedUrls,
    }
}

export function resetQueue() {
    _prefetchQueue = []
    _preloadedUrls.clear()
    _inflightCount = 0
    _listeners = []
}

export function onQueueChange(fn) {
    _listeners.push(fn)
}

function notifyListeners() {
    _listeners.forEach(fn => {
        try { fn() } catch {}
    })
}

export function hasPreloaded(url) {
    return _preloadedUrls.has(url)
}

export function enqueuePrefetch(url, priority, onSubresources) {
    _preloadedUrls.add(url)
    _prefetchQueue.push({ url, priority, onSubresources })
    notifyListeners()
    processQueue()
}

export function processQueue() {
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

