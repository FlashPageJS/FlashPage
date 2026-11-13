/*! Flash Page: Path History & Speculative Navigation */

import { getConfig, logDebug } from './config.js'
import { isPreloadable, getAnchorHref } from './guards.js'

export function initMarkovModel(onPreloadRequest) {
    const config = getConfig()
    if (!config.markov || typeof window === 'undefined' || typeof localStorage === 'undefined') return

    try {
        const prevPath = sessionStorage.getItem('flash_last_path')
        const currentPath = location.pathname

        if (prevPath && prevPath !== currentPath) {
            recordTransition(prevPath, currentPath)
        }
        sessionStorage.setItem('flash_last_path', currentPath)

        // Schedule idle prediction
        const requestIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200))
        requestIdle(() => {
            const predictedPath = predictNextLink(currentPath)
            if (predictedPath) {
                logDebug(`[Markov Model] High probability next destination predicted: ${predictedPath}`)
                const anchors = document.querySelectorAll('a')
                for (const a of anchors) {
                    const href = getAnchorHref(a)
                    if (!href) continue
                    try {
                        const parsed = new URL(href, location.href)
                        if (parsed.pathname === predictedPath && isPreloadable(a)) {
                            onPreloadRequest(href, 'low')
                            break
                        }
                    } catch {}
                }
            }
        })
    } catch {}
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function recordTransition(fromPath, toPath) {
    try {
        if (typeof localStorage === 'undefined' || !fromPath || !toPath) return
        if (typeof fromPath !== 'string' || typeof toPath !== 'string') return
        if (FORBIDDEN_KEYS.has(fromPath) || FORBIDDEN_KEYS.has(toPath)) return

        const raw = localStorage.getItem('flash_markov')
        let matrix = {}
        if (raw) {
            try {
                const parsed = JSON.parse(raw)
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    matrix = parsed
                }
            } catch {}
        }

        const entry = (Object.prototype.hasOwnProperty.call(matrix, fromPath) && typeof matrix[fromPath] === 'object' && !Array.isArray(matrix[fromPath]))
            ? matrix[fromPath]
            : {}
        delete matrix[fromPath] // re-insert so recently used paths survive
        entry[toPath] = (typeof entry[toPath] === 'number' ? entry[toPath] : 0) + 1

        const dests = Object.keys(entry).filter(d => !FORBIDDEN_KEYS.has(d))
        if (dests.length > 5) {
            const weakest = dests
                .filter(d => d !== toPath)
                .sort((a, b) => entry[a] - entry[b])[0]
            if (weakest) delete entry[weakest]
        }
        matrix[fromPath] = entry

        // Cap matrix to 50 source paths (a few KB at most)
        const keys = Object.keys(matrix).filter(k => !FORBIDDEN_KEYS.has(k))
        if (keys.length > 50) {
            delete matrix[keys[0]]
        }

        localStorage.setItem('flash_markov', JSON.stringify(matrix))
    } catch {}
}

export function predictNextLink(fromPath) {
    try {
        if (typeof localStorage === 'undefined' || !fromPath || typeof fromPath !== 'string') return null
        if (FORBIDDEN_KEYS.has(fromPath)) return null

        const raw = localStorage.getItem('flash_markov')
        if (!raw) return null

        const matrix = JSON.parse(raw)
        if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return null
        if (!Object.prototype.hasOwnProperty.call(matrix, fromPath)) return null

        const destinations = matrix[fromPath]
        if (!destinations || typeof destinations !== 'object' || Array.isArray(destinations)) return null

        let total = 0
        let bestDest = null
        let maxCount = 0

        for (const [dest, count] of Object.entries(destinations)) {
            if (FORBIDDEN_KEYS.has(dest) || typeof count !== 'number') continue
            total += count
            if (count > maxCount) {
                maxCount = count
                bestDest = dest
            }
        }

        // Require at least 3 historical visits and >= 60% probability
        if (total >= 3 && (maxCount / total) >= 0.60) {
            return bestDest
        }
        return null
    } catch {
        return null
    }
}

