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

export function recordTransition(fromPath, toPath) {
    try {
        if (typeof localStorage === 'undefined' || !fromPath || !toPath) return
        const raw = localStorage.getItem('flash_markov')
        const matrix = raw ? JSON.parse(raw) : {}

        matrix[fromPath] = matrix[fromPath] || {}
        matrix[fromPath][toPath] = (matrix[fromPath][toPath] || 0) + 1

        localStorage.setItem('flash_markov', JSON.stringify(matrix))
    } catch {}
}

export function predictNextLink(fromPath) {
    try {
        if (typeof localStorage === 'undefined' || !fromPath) return null
        const raw = localStorage.getItem('flash_markov')
        if (!raw) return null

        const matrix = JSON.parse(raw)
        const destinations = matrix[fromPath]
        if (!destinations) return null

        let total = 0
        let bestDest = null
        let maxCount = 0

        for (const [dest, count] of Object.entries(destinations)) {
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

