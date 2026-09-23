/*! Flash Page: Viewport Intersection & Dynamic SPA Mutation Observer */

import { getConfig } from './config.js'
import { isPreloadable, getAnchorHref } from './guards.js'
import { isRapidScrolling } from './input.js'

let _intersectionObserver = null
let _mutationObserver = null

export function resetViewportObservers() {
    if (_intersectionObserver) {
        _intersectionObserver.disconnect()
        _intersectionObserver = null
    }
    if (_mutationObserver) {
        _mutationObserver.disconnect()
        _mutationObserver = null
    }
}

export function setupViewportAndDynamicObserver(signal, onPreloadRequest) {
    const config = getConfig()
    const isViewport = config.intensity === 'viewport' || config.intensity === 'viewport-all'
    if (!isViewport) return

    if (config.intensity === 'viewport') {
        const isSmallScreen = (document.documentElement.clientWidth * document.documentElement.clientHeight) < 450000
        if (!isSmallScreen) return
    }

    const requestIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))

    requestIdle(() => {
        if (signal && signal.aborted) return

        _intersectionObserver = new IntersectionObserver((entries) => {
            if (isRapidScrolling()) return

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const anchor = entry.target
                    if (_intersectionObserver) _intersectionObserver.unobserve(anchor)
                    const href = getAnchorHref(anchor)
                    if (href) onPreloadRequest(href, 'auto')
                }
            })
        }, { rootMargin: '200px' })

        // Observe initial links
        document.querySelectorAll('a').forEach((anchor) => {
            if (isPreloadable(anchor)) _intersectionObserver.observe(anchor)
        })

        // Dynamic SPA & Infinite Scroll observation
        _mutationObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue
                    const anchors = node.matches && node.matches('a') ? [node] : (node.querySelectorAll ? node.querySelectorAll('a') : [])
                    anchors.forEach((a) => {
                        if (isPreloadable(a) && _intersectionObserver) {
                            _intersectionObserver.observe(a)
                        }
                    })
                }
            }
        })

        const bodyTarget = document.body || document.documentElement
        if (bodyTarget) {
            _mutationObserver.observe(bodyTarget, { childList: true, subtree: true })
        }
    })
}

