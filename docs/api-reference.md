# Programmatic API & TypeScript Reference

Flash Page exports an extensive, fully typed programmatic API for single-page applications, custom routers, and performance telemetry.

---

## 1. Core API Functions

### `init(config?)`
Initializes Flash Page with an optional configuration object. If called multiple times, it updates the existing runtime configuration without re-attaching duplicate DOM listeners.

```typescript
function init(config?: Partial<FlashPageConfig>): void
```

#### Example:
```javascript
import { init } from 'flash-page'

init({
    intensity: 65,
    specrules: 'prerender',
    cartSafeguards: true,
    debug: process.env.NODE_ENV === 'development'
})
```

---

### `destroy()`
Completely tears down all active DOM listeners (pointer, touch, keyboard, intersection, mutation), clears pending queues, removes injected Speculation Rules and link tags, and resets runtime state.

```typescript
function destroy(): void
```

#### Example:
```javascript
import { destroy } from 'flash-page'

// In SPA route teardown or test cleanup
destroy()
```

---

### `preload(url, priority?)`
Programmatically schedules a URL for preloading. Automatically verifies URL preloadability through security guards and e-commerce filters before enqueuing.

```typescript
function preload(url: string, priority?: 'high' | 'auto' | 'low'): void
```

#### Parameters:
* `url` (`string`): The absolute or relative target URL.
* `priority` (`'high' | 'auto' | 'low'`, default: `'auto'`): The priority level within the queue. `'high'` jumps to the front of the queue immediately.

#### Example:
```javascript
import { preload } from 'flash-page'

// Preload next step when user completes current step
preload('/checkout/payment', 'high')
```

---

### `status()`
Returns the live operational status of the Flash Page engine, including active speculation modes, queue sizes, effective concurrency, server health, and active configuration.

```typescript
function status(): {
    initialized: boolean
    engine: 'document-rules' | 'speculation-list' | 'link' | 'fetch' | 'none'
    preloadedCount: number
    inflightCount: number
    queueLength: number
    effectiveConcurrency?: number
    isHealthy: boolean
    backpressureUntil: number
    config: FlashPageConfig
}
```

#### Example:
```javascript
import { status } from 'flash-page'

const { initialized, engine, preloadedCount, inflightCount, isHealthy } = status()
console.log(`Flash Page running on engine: ${engine}. In-flight: ${inflightCount}, Total preloaded: ${preloadedCount}`)
```

---

### `getMetrics()`
Retrieves an array of recorded navigation and conversion metric records for the current browser session.

```typescript
function getMetrics(): FlashPageMetric[]
```

#### Example:
```javascript
import { getMetrics } from 'flash-page'

const metrics = getMetrics()
metrics.forEach(m => {
    console.log(`URL: ${m.url}, Prerendered: ${m.wasPrerendered}, LCP Saved: ${m.lcpSavedMs}ms`)
})
```

---

### `isPreloadable(anchor)`
Validates whether a specific HTML element or anchor meets all safety, origin, blacklist, and whitelist conditions.

```typescript
function isPreloadable(anchor: HTMLElement | HTMLAnchorElement | SVGAElement): boolean
```

#### Example:
```javascript
import { isPreloadable } from 'flash-page'

const link = document.querySelector('a#custom-link')
if (isPreloadable(link)) {
    console.log('Link is safe for speculative preloading')
}
```

---

### `isUrlPreloadable(url)`
Validates whether a raw URL string or `URL` object satisfies protocol safety, same-origin restrictions, destructive path filters, and cart safeguards.

```typescript
function isUrlPreloadable(url: string | URL): boolean
```

#### Example:
```javascript
import { isUrlPreloadable } from 'flash-page'

if (isUrlPreloadable('/pricing')) {
    // Safe to preload
}
```

---

### `predictNextLink(fromPath)`
Queries the client-side Markov model for the highest probability next destination based on historic navigation transitions from the given path.

```typescript
function predictNextLink(fromPath: string): string | null
```

#### Example:
```javascript
import { predictNextLink } from 'flash-page'

const predictedUrl = predictNextLink(window.location.pathname)
if (predictedUrl) {
    console.log(`User is most likely to visit next: ${predictedUrl}`)
}
```

---

### `preconnectOrigins(origins)`
Pre-resolves DNS and establishes TCP/TLS handshakes for an array of external origins.

```typescript
function preconnectOrigins(origins: string[]): void
```

#### Example:
```javascript
import { preconnectOrigins } from 'flash-page'

preconnectOrigins([
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdn.example.com'
])
```

---

### `isServerHealthy()`
Returns `false` if the server is currently under backpressure (HTTP 429 or 503 with active `Retry-After` window); otherwise returns `true`.

```typescript
function isServerHealthy(): boolean
```

---

### `isEnvironmentEligible()`
Checks whether the current client device and network are eligible for prefetching (verifies Save-Data, 2G network type, battery level >= 20%, and device memory > 1GB).

```typescript
function isEnvironmentEligible(): boolean
```

---

## 2. Framework Hooks & Adapters

### `useFlashPage(config?)` / `useFlash(config?)`
Universal composable / hook for React, Vue 3, Nuxt 3, and modern framework components. It returns 14 reactive properties, utility methods, and state inspectors:

```typescript
function useFlashPage(config?: Partial<FlashPageConfig>): FlashPageHookReturn
function useFlash(config?: Partial<FlashPageConfig>): FlashPageHookReturn
```

#### Returned Properties & Methods:
* `preload(url, priority?)`: Programmatically enqueues a URL with priority (`'high'`, `'auto'`, `'low'`).
* `destroy()`: Cleans up listeners, cancels queues, and removes injected tags.
* `status`: Getter returning the live engine status object.
* `getStatus()`: Method returning the current status snapshot.
* `getMetrics()`: Retrieves all recorded session navigation metrics.
* `toggleHUD(forceOpen?)`: Opens, closes, or toggles the in-browser DevTools HUD overlay.
* `isPreloadable(anchor)`: Validates whether a DOM anchor meets all safety filters.
* `isUrlPreloadable(url)`: Validates a URL string or object against scheme, origin, and cart guards.
* `predictNextLink(fromPath)`: Queries the Markov AI model for the predicted next destination.
* `preconnectOrigins(origins)`: Pre-resolves DNS and establishes TLS handshakes for external CDNs.
* `isServerHealthy()`: Returns whether origin server is currently free of backpressure (429/503).
* `isEnvironmentEligible()`: Returns whether current network and device battery permit preloading.
* `setBackpressure(retryAfterSeconds?)`: Manually engages origin backpressure cooldown.
* `config`: Getter returning the active runtime configuration object.

---

### `createFlashLink(React)`
Factory function that creates a high-performance `<FlashLink>` component for React and Next.js:

```typescript
function createFlashLink(React: any): React.ForwardRefExoticComponent<FlashLinkProps>
```

#### Props:
* `href`: Target URL destination.
* `priority`: `'high' | 'auto' | 'low'` (default: `'auto'`).
* `asPrerender`: `boolean` to enforce instant 0ms prerendering via Speculation Rules.
* `noFlash`: `boolean` to exempt this link from preloading.

---

### `vFlash` (Vue 3 Directive)
Vue 3 directive supporting arguments and modifiers:
* `v-flash`: Auto-preloads on hover/touch.
* `v-flash:high` or `v-flash.high`: Assigns high priority queue lane.
* `v-flash:prerender` or `v-flash.prerender`: Forces 0ms prerendering.
* `v-flash:no` or `v-flash.noFlash`: Excludes element.

---

### `flashAction(node, options?)` (Svelte Action)
Svelte 5 action for `use:flashAction`:
```html
<a href="/shop" use:flashAction={{ priority: 'high', prerender: true }}>Shop</a>
```

---

### `setupAstroTransitions(config?)` (Astro Adapter)
Lifecycle listener that synchronizes Flash Page across Astro View Transitions page swaps (`astro:page-load`), returning a teardown cleanup function.

---

## 3. Complete TypeScript Definitions

Flash Page includes complete TypeScript declaration files (`flashpage.d.ts` and `flashpage.lite.d.ts`):

```typescript
export interface FlashPageConfig {
    intensity?: '65' | 'mousedown' | 'mousedown-only' | 'viewport' | 'viewport-all' | 'intent-cone' | number
    delayOnHover?: number
    allowQueryString?: boolean
    allowExternalLinks?: boolean
    whitelist?: boolean
    specrules?: 'prefetch' | 'prerender' | 'no'
    predictive?: boolean
    intentCone?: boolean
    respectDataSaver?: boolean
    respectBattery?: boolean
    safariFallback?: boolean
    maxConcurrent?: number
    subresources?: boolean
    markov?: boolean
    backpressure?: boolean
    debug?: boolean
    hud?: boolean
    filter?: (url: URL, anchor: HTMLAnchorElement | HTMLElement) => boolean
    onPreload?: (url: string, priority: 'high' | 'auto' | 'low') => void
    onMetric?: (metric: FlashPageMetric) => void
    nonce?: string | null
    adaptiveConcurrency?: boolean
    beaconUrl?: string | null
    analytics?: 'none' | 'ga4' | 'datadog' | 'sentry' | null
    isolateHeatmaps?: boolean
    cartSafeguards?: boolean
    priorityQueue?: boolean
    preconnectCdn?: boolean
}

export interface FlashPageMetric {
    url: string
    converted: boolean
    transferSize: number
    duration: number
    timestamp: number
    wasPrerendered?: boolean
    activationStart?: number
    lcpSavedMs?: number
}

export interface FlashPageStatus {
    initialized: boolean
    engine: 'document-rules' | 'speculation-list' | 'link' | 'fetch' | 'none'
    preloadedCount: number
    inflightCount: number
    queueLength: number
    effectiveConcurrency?: number
    isHealthy: boolean
    backpressureUntil: number
    config: FlashPageConfig
}

export interface FlashPageHookReturn {
    preload: (url: string, priority?: 'high' | 'auto' | 'low') => void
    destroy: () => void
    status: FlashPageStatus
    getStatus: () => FlashPageStatus
    getMetrics: () => FlashPageMetric[]
    toggleHUD: (forceOpen?: boolean) => void
    isPreloadable: (anchor: HTMLElement | HTMLAnchorElement) => boolean
    isUrlPreloadable: (url: string) => boolean
    predictNextLink: (fromPath: string) => string | null
    preconnectOrigins: (origins: string[]) => void
    isServerHealthy: () => boolean
    isEnvironmentEligible: () => boolean
    setBackpressure: (retryAfterSeconds?: number) => void
    config: FlashPageConfig
}
```
