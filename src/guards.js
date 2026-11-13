/*! Flash Page: Link Validation & Security Guards */

import { getConfig, isServerHealthy } from './config.js'

export function getAnchorHref(anchor) {
    if (!anchor) return null
    if (typeof anchor.href === 'string') return anchor.href
    if (anchor.href && typeof anchor.href.baseVal === 'string') return anchor.href.baseVal
    if (typeof anchor.getAttribute === 'function') return anchor.getAttribute('href')
    return null
}

export function safeDecodeURI(str) {
    if (!str || typeof str !== 'string') return ''
    let decoded = str
    for (let i = 0; i < 2; i++) {
        try {
            const next = decodeURIComponent(decoded)
            if (next === decoded) break
            decoded = next
        } catch {
            break
        }
    }
    return decoded
}

export function isUrlPreloadable(url, config = getConfig(), anchor = null) {
    if (!url || typeof url !== 'string' || !url.trim()) return false
    if (!isServerHealthy()) return false

    // Control characters, null bytes, traversal, and protocol obfuscation checks
    const rawTrimmed = url.trim()
    const strippedRaw = rawTrimmed.toLowerCase().replace(/[\x00-\x20\s]/g, '')
    if (strippedRaw.startsWith('javascript:') || strippedRaw.startsWith('data:') || strippedRaw.startsWith('vbscript:')) {
        return false
    }
    if (url.includes('\0') || url.includes('%00')) {
        return false
    }
    const decodedUrl = safeDecodeURI(url)
    if (decodedUrl.includes('\0') || decodedUrl.includes('..')) {
        return false
    }

    const loc = typeof location !== 'undefined' ? location : null
    let urlObj
    try {
        urlObj = new URL(rawTrimmed, loc ? loc.href : undefined)
    } catch {
        return false
    }

    // Protocol check
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false
    if (loc && urlObj.protocol === 'http:' && loc.protocol === 'https:') return false

    // Reject preloading the exact current page
    if (loc && urlObj.href === loc.href) {
        return false
    }

    const ds = anchor && anchor.dataset ? anchor.dataset : {}
    const isMarkedAllow = 'flash' in ds || 'instant' in ds

    // Whitelist check
    if (config.whitelist && !isMarkedAllow) {
        return false
    }

    // Origin check
    if (loc && urlObj.origin !== loc.origin) {
        const allowed = config.allowExternalLinks || isMarkedAllow
        if (!allowed) return false
    } else if (!loc && !config.allowExternalLinks && !isMarkedAllow && urlObj.origin) {
        // In environments without location, default to rejecting absolute external origins
        if (rawTrimmed.startsWith('http://') || rawTrimmed.startsWith('https://') || rawTrimmed.startsWith('//')) {
            return false
        }
    }

    // Query string check
    if (!config.allowQueryString && urlObj.search && !isMarkedAllow) {
        return false
    }

    // Same-page hash anchor check
    if (loc && urlObj.hash && (urlObj.pathname + urlObj.search === loc.pathname + loc.search)) {
        return false
    }

    // Action path check (sensitive endpoints) with multi-pass decoding
    const path = safeDecodeURI(urlObj.pathname).toLowerCase()
    if (/(^|\/)(logout|signout|sign-out|log-out|delete|destroy|remove|admin|wp-admin|wp-login)(\/|$|\.)/i.test(path)) {
        return false
    }

    // Action query check with multi-pass decoding
    if (urlObj.search) {
        const query = safeDecodeURI(urlObj.search).toLowerCase()
        if (/[?&](action|act|do|op)=(logout|signout|delete|destroy|remove)(&|$)/i.test(query)) {
            return false
        }
    }

    // E-Commerce Cart & Checkout Guard
    if (config.cartSafeguards) {
        if (/(^|\/)(cart|checkout|basket|bag|shopping-cart|shopping-basket|my-cart|orders?|my-account|customer\/account|account|billing|payment)(\/|$|\.)/i.test(path)) {
            return false
        }
        if (urlObj.search) {
            const query = safeDecodeURI(urlObj.search).toLowerCase()
            if (/[?&](add-to-cart|wc-ajax|empty-cart|cart_action|cart-action|remove_item|undo_item)(=|&|$)/i.test(query)) {
                return false
            }
        }
    }

    // Custom user filter callback
    if (typeof config.filter === 'function') {
        try {
            if (!config.filter(urlObj, anchor)) return false
        } catch {
            return false
        }
    }

    return true
}

export function isPreloadable(anchor) {
    if (!anchor) return false

    // Server health check
    if (!isServerHealthy()) return false

    // Normalize raw href from HTMLAnchorElement, SVGAElement, or generic element
    const rawHref = getAnchorHref(anchor)
    if (!rawHref || typeof rawHref !== 'string' || !rawHref.trim()) return false

    const config = getConfig()
    const ds = anchor.dataset || {}

    const isMarkedAllow = 'flash' in ds || 'instant' in ds
    const isMarkedDisallow = 'noFlash' in ds || 'noInstant' in ds

    // Whitelist check
    if (config.whitelist && !isMarkedAllow) {
        return false
    }

    // Blacklist check
    if (isMarkedDisallow) {
        return false
    }

    // Download attribute check
    if (typeof anchor.hasAttribute === 'function' && anchor.hasAttribute('download')) {
        return false
    }

    // Target attribute check (normalize HTMLAnchorElement and SVGAElement target)
    const targetVal = typeof anchor.target === 'string'
        ? anchor.target
        : (anchor.target && typeof anchor.target.baseVal === 'string'
            ? anchor.target.baseVal
            : (typeof anchor.getAttribute === 'function' ? anchor.getAttribute('target') : null))
    if (targetVal && targetVal !== '_self') {
        return false
    }

    // Rel check: nofollow
    const relVal = anchor.relList && typeof anchor.relList.contains === 'function'
        ? anchor.relList.contains('nofollow')
        : (typeof anchor.getAttribute === 'function' && /\bnofollow\b/i.test(anchor.getAttribute('rel') || ''))
    if (relVal) {
        return false
    }

    // Action links check (Rails, Turbo, HTMX)
    if (typeof anchor.hasAttribute === 'function') {
        if (anchor.hasAttribute('data-method') ||
                anchor.hasAttribute('data-turbo-method') ||
                anchor.hasAttribute('hx-post') ||
                anchor.hasAttribute('hx-delete')) {
            return false
        }
    }

    // E-Commerce attribute and class checks
    if (config.cartSafeguards) {
        if (typeof anchor.hasAttribute === 'function') {
            if (anchor.hasAttribute('data-cart-action') ||
                anchor.hasAttribute('data-add-to-cart') ||
                anchor.hasAttribute('data-woocommerce')) {
                return false
            }
        }
        if (anchor.classList && typeof anchor.classList.contains === 'function') {
            if (anchor.classList.contains('add_to_cart_button') ||
                anchor.classList.contains('single_add_to_cart_button') ||
                anchor.classList.contains('ajax_add_to_cart')) {
                return false
            }
        }
    }

    return isUrlPreloadable(rawHref, config, anchor)
}

export function isolateHeatmaps() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    const config = getConfig()
    if (!config.isolateHeatmaps) return

    if ('prerendering' in document && document.prerendering) {
        if (window.hj && typeof window.hj.pause === 'function') {
            try { window.hj.pause() } catch {}
        }
        if (window.clarity && typeof window.clarity.pause === 'function') {
            try { window.clarity.pause() } catch {}
        }
        if (window.FS && typeof window.FS.shutdown === 'function') {
            try { window.FS.shutdown() } catch {}
        }

        document.addEventListener('prerenderingchange', () => {
            if (window.hj && typeof window.hj.resume === 'function') {
                try { window.hj.resume() } catch {}
            }
            if (window.clarity && typeof window.clarity.resume === 'function') {
                try { window.clarity.resume() } catch {}
            }
            if (window.FS && typeof window.FS.restart === 'function') {
                try { window.FS.restart() } catch {}
            }
        }, { once: true })
    }
}

