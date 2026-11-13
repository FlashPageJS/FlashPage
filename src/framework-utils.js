/*! Flash Page: Framework Ecosystem Adapters (React, Vue, Svelte, Astro) */

import { preload, status, getMetrics, init, destroy } from './index.js'
import { getAnchorHref, isPreloadable, isUrlPreloadable } from './guards.js'
import { getConfig, isServerHealthy, isEnvironmentEligible, setBackpressure } from './config.js'
import { predictNextLink } from './markov.js'
import { preconnectOrigins } from './subresources.js'
import { toggleHUD } from './hud.js'

/**
 * React & Next.js hook for Flash Page integration
 * Provides full access to all Flash Page capabilities, status, and telemetry.
 * @param {Partial<import('../flashpage.d.ts').FlashPageConfig>} [config]
 */
export function useFlashPage(config = {}) {
    if (typeof window !== 'undefined') {
        init(config)
    }
    return {
        preload,
        destroy,
        get status() { return status() },
        getStatus: status,
        getMetrics,
        toggleHUD,
        isPreloadable,
        isUrlPreloadable,
        predictNextLink,
        preconnectOrigins,
        isServerHealthy,
        isEnvironmentEligible,
        setBackpressure,
        get config() { return getConfig() },
    }
}

/**
 * React FlashLink Component Factory / Helper
 * Compatible with React, Preact, and Next.js
 */
export function createFlashLink(React) {
    if (!React || typeof React.createElement !== 'function') return null

    const FlashLinkComponent = (props, ref) => {
        const {
            href,
            priority = 'auto',
            asPrerender = false,
            noFlash = false,
            onPointerOver,
            onPointerDown,
            children,
            ...rest
        } = props

        const handlePointerOver = (e) => {
            if (href && !noFlash) preload(href, priority)
            if (typeof onPointerOver === 'function') onPointerOver(e)
        }

        const handlePointerDown = (e) => {
            if (href && !noFlash) preload(href, 'high')
            if (typeof onPointerDown === 'function') onPointerDown(e)
        }

        const linkProps = {
            ...rest,
            ref,
            href,
            onPointerOver: handlePointerOver,
            onPointerDown: handlePointerDown,
        }

        if (asPrerender) {
            linkProps['data-flash-specrules'] = 'prerender'
        }
        if (priority === 'high') {
            linkProps['data-flash-priority'] = 'high'
        }
        if (noFlash) {
            linkProps['data-no-flash'] = ''
        }

        return React.createElement('a', linkProps, children)
    }

    return typeof React.forwardRef === 'function'
        ? React.forwardRef(FlashLinkComponent)
        : FlashLinkComponent
}

/**
 * Standalone React component (created with global React if available)
 */
export const FlashLink = typeof window !== 'undefined' && window.React
    ? createFlashLink(window.React)
    : null

/**
 * Vue 3 directive for Flash Page
 * Supports v-flash, v-flash:high, v-flash:low, v-flash:prerender, v-flash:no,
 * and modifiers: v-flash.prerender, v-flash.high, v-flash.noFlash
 */
export const vFlash = {
    mounted(el, binding) {
        setupVueElement(el, binding)
    },
    updated(el, binding) {
        setupVueElement(el, binding)
    }
}

function setupVueElement(el, binding) {
    if (!el) return
    const hasSetAttr = typeof el.setAttribute === 'function'
    const modifiers = (binding && binding.modifiers) || {}
    const arg = (binding && binding.arg) || ''

    if (modifiers.noFlash || arg === 'no-flash' || arg === 'no') {
        if (hasSetAttr) el.setAttribute('data-no-flash', '')
        return
    }

    const isHigh = Boolean(modifiers.high || arg === 'high')
    const isLow = Boolean(modifiers.low || arg === 'low')
    const priority = isHigh ? 'high' : isLow ? 'low' : 'auto'

    const targetUrl = binding && typeof binding.value === 'string'
        ? binding.value
        : getAnchorHref(el)

    if (hasSetAttr) {
        if (modifiers.prerender || arg === 'prerender') {
            el.setAttribute('data-flash-specrules', 'prerender')
        } else {
            el.setAttribute('data-flash', '')
        }

        if (isHigh) {
            el.setAttribute('data-flash-priority', 'high')
        }
    }

    if (targetUrl && binding && binding.value) {
        preload(targetUrl, priority)
    }
}

/**
 * Vue 3 & Nuxt 3 composable
 */
export function useFlash(config = {}) {
    return useFlashPage(config)
}

/**
 * Svelte 5 action for use:flashAction
 * Usage: <a href="/shop" use:flashAction={{ priority: 'high', prerender: true }}>Shop</a>
 */
export function flashAction(node, options = {}) {
    if (!node) return {}

    const isExcluded = () => Boolean(options && (options.noFlash || options.exclude))
    const getTarget = () => (options && options.href) || getAnchorHref(node)
    const getPrio = () => (options && options.priority) || 'auto'

    const setupAttributes = () => {
        if (!node || typeof node.setAttribute !== 'function') return
        if (isExcluded()) {
            node.setAttribute('data-no-flash', '')
        } else {
            if (options && options.prerender) {
                node.setAttribute('data-flash-specrules', 'prerender')
            }
            if (options && options.priority === 'high') {
                node.setAttribute('data-flash-priority', 'high')
            }
        }
    }

    setupAttributes()

    const onHover = () => {
        if (isExcluded()) return
        const url = getTarget()
        if (url) preload(url, getPrio())
    }

    const onDown = () => {
        if (isExcluded()) return
        const url = getTarget()
        if (url) preload(url, 'high')
    }

    node.addEventListener('pointerover', onHover, { passive: true })
    node.addEventListener('pointerdown', onDown, { passive: true })

    return {
        update(newOptions) {
            options = newOptions || {}
            setupAttributes()
        },
        destroy() {
            node.removeEventListener('pointerover', onHover)
            node.removeEventListener('pointerdown', onDown)
        }
    }
}

/**
 * Astro View Transitions Adapter
 * Automatically initializes and synchronizes Flash Page across Astro page swaps
 */
export function setupAstroTransitions(config = {}) {
    if (typeof document === 'undefined') return () => {}

    const onPageLoad = () => {
        destroy()
        init(config)
    }

    document.addEventListener('astro:page-load', onPageLoad)

    return () => {
        document.removeEventListener('astro:page-load', onPageLoad)
    }
}
