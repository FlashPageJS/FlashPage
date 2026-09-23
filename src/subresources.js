/*! Flash Page: Subresource & Critical Asset Pre-warming */

export function extractSubresources(htmlText) {
    if (!htmlText || typeof htmlText !== 'string') return []
    const subresources = []

    // Extract <link ...> tags and check for rel="stylesheet" or as="font" regardless of attribute order
    const linkMatches = htmlText.matchAll(/<link\b([^>]+)>/gi)
    for (const m of linkMatches) {
        const attrs = m[1]
        const isStylesheet = /\brel\s*=\s*["']stylesheet["']/i.test(attrs)
        const isFont = /\bas\s*=\s*["']font["']/i.test(attrs)

        if (isStylesheet || isFont) {
            const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)
            if (hrefMatch && hrefMatch[1]) {
                subresources.push(hrefMatch[1])
            }
        }
    }

    return subresources.slice(0, 4)
}

export function prewarmSubresources(htmlText) {
    const assets = extractSubresources(htmlText)
    assets.forEach((assetUrl) => {
        try {
            fetch(assetUrl, { priority: 'low', mode: 'no-cors' }).catch(() => {})
        } catch {}
    })
}

