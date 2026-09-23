/*! Flash Page: Preload & Speculation Engines */

import { getConfig, logDebug, setBackpressure } from './config.js'

let _speculationMode = 'none' // 'document-rules' | 'speculation-list' | 'link' | 'fetch'

export function getEngine() {
    return _speculationMode
}

export function resetEngine() {
    _speculationMode = 'none'
    if (typeof document !== 'undefined') {
        const injectedRules = document.querySelectorAll('script[data-flash-rules]')
        injectedRules.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el)
        })
        const injectedLinks = document.querySelectorAll('link[data-flash-link]')
        injectedLinks.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el)
        })
    }
}

export function setupEngine() {
    const config = getConfig()

    const supportsSpeculationRules = typeof HTMLScriptElement !== 'undefined' &&
        HTMLScriptElement.supports &&
        HTMLScriptElement.supports('speculationrules')

    const supportsPrefetchRel = typeof document !== 'undefined' &&
        document.createElement('link').relList &&
        document.createElement('link').relList.supports &&
        document.createElement('link').relList.supports('prefetch')

    if (supportsSpeculationRules && config.specrules !== 'no') {
        const injected = setupDocumentSpeculationRules()
        if (injected) {
            _speculationMode = 'document-rules'
            return _speculationMode
        }
        _speculationMode = 'speculation-list'
    } else if (supportsPrefetchRel) {
        _speculationMode = 'link'
    } else if (config.safariFallback && typeof fetch === 'function') {
        _speculationMode = 'fetch'
    } else {
        _speculationMode = 'none'
    }

    return _speculationMode
}

export function setupDocumentSpeculationRules() {
    try {
        const config = getConfig()
        const script = document.createElement('script')
        script.type = 'speculationrules'
        script.setAttribute('data-flash-rules', '')

        const action = config.specrules === 'prerender' ? 'prerender' : 'prefetch'
        const eagerness = config.intensity === 'mousedown' || config.intensity === 'mousedown-only'
            ? 'conservative'
            : 'moderate'

        const documentRule = {
            [action]: [
                {
                    source: 'document',
                    where: {
                        and: [
                            { href_matches: '/*' },
                            {
                                not: {
                                    selector_matches: [
                                        '[data-no-flash]',
                                        '[data-no-instant]',
                                        '[download]',
                                        '[target="_blank"]',
                                        '[rel~="nofollow"]',
                                        '[data-method]',
                                        '[data-turbo-method]',
                                        '[hx-post]',
                                        '[hx-delete]',
                                        '[href*="/logout"]',
                                        '[href*="/signout"]',
                                        '[href*="/delete"]',
                                        '[href*="/destroy"]',
                                        '[href*="/remove"]',
                                    ].join(', ')
                                }
                            }
                        ]
                    },
                    eagerness,
                }
            ]
        }

        script.textContent = JSON.stringify(documentRule)
        const target = document.head || document.documentElement
        if (target) target.appendChild(script)
        return true
    } catch (err) {
        logDebug('Document Rules injection failed, falling back to dynamic list:', err)
        return false
    }
}

export function preloadUsingSpeculationList(url, type) {
    const script = document.createElement('script')
    script.type = 'speculationrules'
    script.setAttribute('data-flash-rules', '')
    script.textContent = JSON.stringify({
        [type]: [{
            source: 'list',
            urls: [url]
        }]
    })
    const target = document.head || document.documentElement
    if (target) target.appendChild(script)
    return new Promise(resolve => setTimeout(resolve, 400))
}

export function preloadUsingLink(url, priority = 'auto') {
    return new Promise((resolve) => {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = url
        link.as = 'document'
        link.setAttribute('data-flash-link', '')
        if (priority !== 'auto') {
            link.fetchPriority = priority
        }
        let settled = false
        const done = () => {
            if (!settled) {
                settled = true
                resolve()
            }
        }
        link.addEventListener('load', done, { once: true })
        link.addEventListener('error', done, { once: true })
        setTimeout(done, 500)
        const target = document.head || document.documentElement
        if (target) target.appendChild(link)
    })
}

export async function preloadUsingFetch(url) {
    try {
        const res = await fetch(url, {
            priority: 'low',
            credentials: 'same-origin',
            headers: { 'Purpose': 'prefetch' }
        })

        const config = getConfig()
        // Backpressure handling (429 Too Many Requests or 503 Service Unavailable)
        if (config.backpressure && (res.status === 429 || res.status === 503)) {
            const retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 30
            setBackpressure(retryAfter)
            logDebug(`Server 429/503 received. Backing off prefetch for ${retryAfter}s`)
        }

        return res
    } catch (err) {
        return null
    }
}

