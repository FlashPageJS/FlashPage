/*! Flash Page: Framework Utilities (React & Vue) */

import { preload, status, getMetrics, init } from './index.js'

/**
 * React hook for Flash Page integration
 */
export function useFlashPage(config = {}) {
    if (typeof window !== 'undefined') {
        init(config)
    }
    return {
        preload,
        status: status(),
        getMetrics: getMetrics(),
    }
}

/**
 * Vue 3 directive for Flash Page
 */
export const vFlash = {
    mounted(el, binding) {
        if (binding && binding.value) {
            preload(binding.value, 'high')
        } else if (el.href) {
            el.setAttribute('data-flash', '')
        }
    }
}

