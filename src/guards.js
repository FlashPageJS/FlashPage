/*! Flash Page: Link Validation & Security Guards */

import { getConfig, isServerHealthy } from './config.js'

export function getAnchorHref(anchor) {
    if (!anchor) return null
    if (typeof anchor.href === 'string') return anchor.href
    if (anchor.href && typeof anchor.href.baseVal === 'string') return anchor.href.baseVal
    if (typeof anchor.getAttribute === 'function') return anchor.getAttribute('href')
    return null
}

export function isPreloadable(anchor) {
    if (!anchor) return false

    // Server health check
    if (!isServerHealthy()) return false

    // Normalize raw href from HTMLAnchorElement, SVGAElement, or generic element
    const rawHref = getAnchorHref(anchor)
    if (!rawHref || typeof rawHref !== 'string' || !rawHref.trim()) return false

    // Parse URL safely with current location
    const loc = typeof location !== 'undefined' ? location : null
    let urlObj
    try {
        urlObj = new URL(rawHref.trim(), loc ? loc.href : undefined)
    } catch {
        return false
    }

    // Reject preloading the exact current page
    if (loc && urlObj.href === loc.href) {
        return false
    }

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

    // Target attribute check (e.g. target="_blank")
    if (anchor.target && anchor.target !== '_self') {
        return false
    }

    // Rel check: nofollow
    if (anchor.relList && typeof anchor.relList.contains === 'function' && anchor.relList.contains('nofollow')) {
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

    // Origin check
    if (loc && urlObj.origin !== loc.origin) {
        const allowed = config.allowExternalLinks || isMarkedAllow
        if (!allowed) return false
    }

    // Protocol check
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false
    if (loc && urlObj.protocol === 'http:' && loc.protocol === 'https:') return false

    // Query string check
    if (!config.allowQueryString && urlObj.search && !isMarkedAllow) {
        return false
    }

    // Same-page hash anchor check
    if (loc && urlObj.hash && (urlObj.pathname + urlObj.search === loc.pathname + loc.search)) {
        return false
    }

    // Action path check (sensitive endpoints)
    const path = urlObj.pathname.toLowerCase()
    if (path.includes('/logout') || path.includes('/signout') || path.includes('/delete') || path.includes('/destroy') || path.includes('/remove')) {
        return false
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

