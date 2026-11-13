/*! Flash Page: Subresource & Critical Asset Pre-warming */

import { getConfig } from './config.js'

let _preconnectedOrigins = new Set()

export function getPreconnectedOrigins() {
    return new Set(_preconnectedOrigins)
}

export function resetSubresources() {
    _preconnectedOrigins.clear()
    if (typeof document !== 'undefined') {
        const injected = document.querySelectorAll('link[data-flash-preconnect], link[data-flash-dns]')
        injected.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el)
        })
    }
}

export function extractSubresources(htmlText) {
    if (!htmlText || typeof htmlText !== 'string') return []
    const subresources = []

    // Extract <link ...> tags and check for rel="stylesheet" or as="font" regardless of attribute order
    const linkMatches = htmlText.matchAll(/<link\b([^>]+)>/gi)
    for (const m of linkMatches) {
        const attrs = m[1]
        const isStylesheet = /\brel\s*=\s*(?:["']stylesheet["']|stylesheet\b)/i.test(attrs)
        const isFont = /\bas\s*=\s*(?:["']font["']|font\b)/i.test(attrs)

        if (isStylesheet || isFont) {
            const hrefMatch = attrs.match(/\bhref\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/i)
            const hrefVal = hrefMatch ? (hrefMatch[1] || hrefMatch[2]) : null
            if (hrefVal) {
                subresources.push(hrefVal)
            }
        }
    }

    return subresources.slice(0, 4)
}

export function extractExternalOrigins(htmlText) {
    if (!htmlText || typeof htmlText !== 'string') return []
    const assets = extractSubresources(htmlText)
    const origins = new Set()
    const loc = typeof location !== 'undefined' ? location : null

    for (const assetUrl of assets) {
        try {
            const parsed = new URL(assetUrl, loc ? loc.href : undefined)
            if (['http:', 'https:'].includes(parsed.protocol)) {
                if (!loc || parsed.origin !== loc.origin) {
                    origins.add(parsed.origin)
                }
            }
        } catch {}
    }

    return Array.from(origins).slice(0, 4)
}

export function preconnectOrigins(origins) {
    if (typeof document === 'undefined' || !Array.isArray(origins)) return
    const target = document.head || document.documentElement
    if (!target) return

    for (const origin of origins) {
        if (!origin || _preconnectedOrigins.has(origin)) continue
        if (_preconnectedOrigins.size >= 20) break
        _preconnectedOrigins.add(origin)

        try {
            const linkPreconnect = document.createElement('link')
            linkPreconnect.rel = 'preconnect'
            linkPreconnect.href = origin
            linkPreconnect.crossOrigin = ''
            linkPreconnect.setAttribute('data-flash-preconnect', '')
            target.appendChild(linkPreconnect)

            const linkDns = document.createElement('link')
            linkDns.rel = 'dns-prefetch'
            linkDns.href = origin
            linkDns.setAttribute('data-flash-dns', '')
            target.appendChild(linkDns)
        } catch {}
    }
}

export function prewarmSubresources(htmlText, config = getConfig()) {
    const assets = extractSubresources(htmlText)
    const loc = typeof location !== 'undefined' ? location : null
    assets.forEach((assetUrl) => {
        try {
            const parsed = new URL(assetUrl, loc ? loc.href : undefined)
            if (['http:', 'https:'].includes(parsed.protocol)) {
                fetch(assetUrl, { priority: 'low', mode: 'no-cors' }).catch(() => {})
            }
        } catch {}
    })

    if (config.preconnectCdn) {
        const origins = extractExternalOrigins(htmlText)
        if (origins.length > 0) {
            preconnectOrigins(origins)
        }
    }
}
