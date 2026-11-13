/*! Flash Page: Concurrency Queue Manager */

import { getConfig, logDebug } from './config.js'
import { getEngine, setupEngine, preloadUsingSpeculationList, preloadUsingLink, preloadUsingFetch } from './engines.js'

let _preloadedUrls = new Set()
let _inflightCount = 0
let _prefetchQueue = []
let _listeners = []

export function getEffectiveConcurrency(config = getConfig()) {
    if (!config.adaptiveConcurrency) return config.maxConcurrent
    if (typeof navigator !== 'undefined' && navigator.connection) {
        const conn = navigator.connection
        if ((typeof conn.downlink === 'number' && conn.downlink >= 10) || (typeof conn.rtt === 'number' && conn.rtt > 0 && conn.rtt < 50)) {
            return Math.min(6, Math.max(config.maxConcurrent, config.maxConcurrent * 2))
        }
        if ((typeof conn.downlink === 'number' && conn.downlink < 1.5) || (typeof conn.rtt === 'number' && conn.rtt > 250)) {
            return 1
        }
    }
    return config.maxConcurrent
}

export function getPriorityWeight(priority) {
    if (priority === 'high') return 3
    if (priority === 'low') return 1
    return 2 // 'auto', 'medium', or undefined
}

export function getQueueStatus() {
    return {
        preloadedCount: _preloadedUrls.size,
        inflightCount: _inflightCount,
        queueLength: _prefetchQueue.length,
        preloadedUrls: _preloadedUrls,
        effectiveConcurrency: getEffectiveConcurrency(),
        queue: _prefetchQueue.map(item => ({ url: item.url, priority: item.priority })),
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

export function enqueuePrefetch(url, priority = 'auto', onSubresources) {
    _preloadedUrls.add(url)
    const config = getConfig()
    const weight = getPriorityWeight(priority)
    const item = { url, priority, onSubresources, weight, timestamp: Date.now() }

    if (config.priorityQueue) {
        // Insert before the first item with less-or-equal weight (priority order + LIFO within tier)
        const idx = _prefetchQueue.findIndex(q => q.weight <= weight)
        if (idx === -1) {
            _prefetchQueue.push(item)
        } else {
            _prefetchQueue.splice(idx, 0, item)
        }
    } else {
        _prefetchQueue.push(item)
    }

    notifyListeners()
    processQueue()
}

export function processQueue() {
    const config = getConfig()
    const limit = getEffectiveConcurrency(config)
    while (_inflightCount < limit && _prefetchQueue.length > 0) {
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

