# Migrating from Quicklink

This guide explains how to migrate from **Quicklink** (Google Chrome Labs) to **Flash Page**.

---

## 1. Architectural Differences: Viewport-Heavy vs. Intent-First

Quicklink operates primarily by prefetching all links as they scroll into the viewport (`IntersectionObserver`). While effective for lightweight blogs, viewport-heavy prefetching presents challenges on media-heavy, dynamic, or e-commerce sites:

* **Bandwidth Overhead**: Viewport prefetching can trigger dozens of unnecessary document downloads as users rapidly scroll past content.
* **Server Load**: Aggressive prefetching of every link in the DOM can overwhelm servers during traffic surges.
* **Lack of Mutation Protection**: Quicklink does not natively protect `/cart`, `/checkout`, or e-commerce state endpoints.

### How Flash Page Improves on Quicklink:
1. **User-Intent Targeting**: Preloads upon hover (65ms), pointer down, or cursor trajectory cone, capturing genuine visitor navigation intent.
2. **Native Speculation Rules API**: Leverages Chrome 121+ declarative Document Rules and List Rules for instant **0ms prerendering**.
3. **Server Backpressure**: Automatically halts prefetching on HTTP 429 or 503 responses with `Retry-After`.
4. **Built-In Cart Shields**: Automatically protects e-commerce, checkout, and session routes.

---

## 2. Configuration & API Mapping

Migrating from Quicklink to Flash Page is straightforward:

| Quicklink Option | Flash Page Equivalent | Description |
| :--- | :--- | :--- |
| `quicklink.listen({ el: ... })` | `init({ ... })` | Flash Page automatically observes the entire document. |
| `origins: ['example.com']` | `allowExternalLinks: true` | Control whether external links can be speculated. |
| `ignores: [ /regex/, url => ... ]` | `filter: (url, anchor) => ...` | Custom predicate function to veto links. |
| `throttle: 2` | `maxConcurrent: 2` | Cap on concurrent in-flight requests. |
| `priority: true` | `priorityQueue: true` | Prioritized queue scheduling. |
| `prerender: true` | `specrules: 'prerender'` | Enables native browser prerendering. |

---

## 3. Code Migration Example

### Before (Quicklink):
```javascript
import { listen } from 'quicklink'

listen({
    throttle: 3,
    ignores: [
        /logout/,
        /cart/,
        (uri, elem) => elem.hasAttribute('noprefetch')
    ]
})
```

### After (Flash Page):
```javascript
import { init } from 'flash-page'

init({
    intensity: 65,            // Intent-based hover
    specrules: 'prerender',   // 0ms instant display
    maxConcurrent: 3,         // Concurrency limiter
    cartSafeguards: true,     // Automatically shields /cart, /checkout, etc.
    priorityQueue: true,      // High priority queue for user clicks
    filter: (url, anchor) => {
        if (anchor.hasAttribute('noprefetch')) return false
        return true
    }
})
```

---

## 4. Retaining Viewport Prefetching if Desired

If your application specifically benefits from preloading links as they enter the screen, Flash Page supports viewport prefetching via the `intensity` parameter:

```javascript
// Preload all links as they enter the viewport
init({ intensity: 'viewport-all' })

// Or preload only on small mobile viewports
init({ intensity: 'viewport' })
```
