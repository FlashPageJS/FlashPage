# Configuration Reference (All 28 Master Parameters)

Flash Page offers **28 fine-grained configuration parameters** that govern prefetch timing, browser speculation engines, concurrency, e-commerce cart shields, device awareness, and analytics.

---

## Master Parameters Matrix

| # | Parameter | Type | Default | HTML Dataset Attribute | Description |
| :-: | :--- | :---: | :---: | :--- | :--- |
| **1** | `intensity` | `string \| number` | `65` | `data-flash-intensity` | Preload trigger mode (`65`, `mousedown`, `mousedown-only`, `viewport`, `viewport-all`, `intent-cone`) or custom hover delay in milliseconds. |
| **2** | `delayOnHover` | `number` | `65` | `data-flash-delay-on-hover` | Explicit delay in milliseconds user must hover before preload begins. |
| **3** | `allowQueryString` | `boolean` | `false` | `data-flash-allow-query-string` | Allow preloading URLs containing query parameters (`?filter=`, `?page=`). |
| **4** | `allowExternalLinks` | `boolean` | `false` | `data-flash-allow-external-links` | Allow prefetching cross-origin / external URLs. |
| **5** | `whitelist` | `boolean` | `false` | `data-flash-whitelist` | Whitelist-only mode: only preload links marked with `data-flash` or `data-instant`. |
| **6** | `specrules` | `string` | `'prefetch'` | `data-flash-specrules` | Speculation Rules mode: `'prefetch'` (document cache), `'prerender'` (0ms full execution), or `'no'` (disabled). |
| **7** | `predictive` | `boolean` | `false` | `data-flash-predictive` | Legacy alias for `intentCone` velocity vector calculation. |
| **8** | `intentCone` | `boolean` | `true` | `data-flash-no-intent-cone` (to disable) | Predict mouse trajectory towards links using 3-point velocity vector physics. |
| **9** | `respectDataSaver` | `boolean` | `true` | `data-flash-no-data-saver` (to disable) | Halt prefetching if user enables browser Save-Data or is on slow 2G connection. |
| **10** | `respectBattery` | `boolean` | `true` | `data-flash-no-battery` (to disable) | Halt prefetching if device battery level drops below 20% while discharging. |
| **11** | `safariFallback` | `boolean` | `true` | `data-flash-no-safari-fallback` (to disable) | Use low-priority `fetch()` warming on Safari and WebKit browsers. |
| **12** | `maxConcurrent` | `number` | `3` | `data-flash-max-concurrent` | Maximum number of simultaneous in-flight speculative network requests (1 to 6). |
| **13** | `subresources` | `boolean` | `false` | `data-flash-subresources` | Extract and pre-warm critical stylesheet and webfont subresources from preloaded HTML. |
| **14** | `markov` | `boolean` | `true` | `data-flash-no-markov` (to disable) | Local client-side Markov model that predicts next link during idle time. |
| **15** | `backpressure` | `boolean` | `true` | `data-flash-no-backpressure` (to disable) | Auto-suspend prefetching for 30s-300s upon HTTP 429 Too Many Requests or 503 Retry-After. |
| **16** | `debug` | `boolean` | `false` | `data-flash-debug` | Print diagnostic messages and lifecycle traces to browser developer console. |
| **17** | `hud` | `boolean` | `false` | `data-flash-hud` | Enable the in-browser DevTools HUD overlay (toggle with `Ctrl+Shift+F`). |
| **18** | `filter` | `function` | `null` | *(JS only)* | Custom predicate function `(urlObj, anchor) => boolean` to approve or veto links. |
| **19** | `onPreload` | `function` | `null` | *(JS only)* | Callback invoked when a link begins preloading: `(url, priority) => void`. |
| **20** | `onMetric` | `function` | `null` | *(JS only)* | Callback invoked on navigation timing measurement: `(metric) => void`. |
| **21** | `nonce` | `string` | `null` | `data-flash-nonce` | CSP nonce string applied to injected `<script type="speculationrules">` tags. |
| **22** | `adaptiveConcurrency` | `boolean` | `false` | `data-flash-adaptive-concurrency` | Dynamically scale concurrency (1 to 6) based on Network Information API. |
| **23** | `beaconUrl` | `string` | `null` | `data-flash-beacon-url` | Telemetry endpoint URL to receive navigation conversion metrics via `navigator.sendBeacon`. |
| **24** | `analytics` | `string` | `null` | `data-flash-analytics` | Built-in analytics exporter: `'ga4'`, `'datadog'`, `'sentry'`, or `'none'`. |
| **25** | `isolateHeatmaps` | `boolean` | `true` | `data-flash-no-isolate-heatmaps` (to disable) | Pause Hotjar, Microsoft Clarity, and FullStory during background prerendering. |
| **26** | `cartSafeguards` | `boolean` | `true` | `data-flash-no-cart-safeguards` (to disable) | Guard cart, checkout, WooCommerce, and e-commerce mutation endpoints. |
| **27** | `priorityQueue` | `boolean` | `true` | `data-flash-no-priority-queue` (to disable) | Prioritized queue scheduling: jump user interaction preloads ahead of idle links. |
| **28** | `preconnectCdn` | `boolean` | `true` | `data-flash-no-preconnect-cdn` (to disable) | Subresource Preconnect 2.0: pre-resolve DNS and TLS handshakes for external CDNs. |

---

## Detailed Parameter Breakdown

### 1. Intensity Trigger (`intensity`)
Defines the trigger mechanism and timing that initiates speculative prefetching:
* `'65'` (default): Initiates prefetch when the cursor hovers over a link for 65 milliseconds.
* `'mousedown'`: Initiates prefetch immediately on `pointerdown` (when mouse button is pressed or touch screen is touched), offering ~100-200ms speedup with zero hover overhead.
* `'mousedown-only'`: Exclusively preloads on `pointerdown` and completely ignores hover gestures.
* `'viewport'`: Preloads links when they enter the mobile viewport on screens under 450,000 pixels (~portrait phone).
* `'viewport-all'`: Preloads all links as soon as they scroll into the browser viewport regardless of screen size.
* `'intent-cone'`: Predicts the user's cursor velocity vector and preloads links before the pointer even reaches them.
* Custom Number (e.g. `120`): Preloads after the specified hover duration in milliseconds.

```javascript
init({ intensity: 'intent-cone' })
```

### 2. Speculation Rules Mode (`specrules`)
Controls native Chromium Speculation Rules behavior:
* `'prefetch'` (default): Downloads the HTML document into the browser memory cache. Safe for all architectures.
* `'prerender'`: Fully executes and renders the page in a background browser tab. Produces instant **0ms** navigation.
* `'no'`: Disables native Speculation Rules and uses standard `<link rel="prefetch">` or fetch warming.

```javascript
init({ specrules: 'prerender' })
```

### 3. Cart & E-Commerce Safeguards (`cartSafeguards`)
Active by default (`true`). Automatically inspects target paths and query strings, permanently vetoing URLs matching:
* Paths: `/cart`, `/checkout`, `/basket`, `/bag`, `/order`, `/my-account`, `/customer/account`
* Queries: `?add-to-cart=`, `?wc-ajax=`, `?empty-cart=`, `?remove_item=`, `?undo_item=`
* Elements: Buttons with `.add_to_cart_button`, `[data-cart-action]`, `[data-add-to-cart]`

```javascript
init({ cartSafeguards: true })
```

### 4. Server Backpressure Protection (`backpressure`)
When active (`true`, default), Flash Page automatically monitors background fetch responses for HTTP **429** (Too Many Requests) and **503** (Service Unavailable). If detected:
1. Reads the `Retry-After` response header (or defaults to 30 seconds, safety-capped at 300 seconds).
2. Completely halts all speculative prefetching across the entire site until the cooldown window expires.
3. Automatically resumes normal prefetching once the server recovers.

### 5. Priority Queue Scheduling (`priorityQueue`)
Organizes requests into three discrete queues:
* **High Priority Queue**: Pointer interaction links (`pointerdown` or intentional hover).
* **Auto Priority Queue**: Standard hovered links and viewport links.
* **Low Priority Queue**: Markov AI idle-time predictions and subresource pre-warming.

Whenever a user moves their mouse over a link, that link jumps to the front of the queue, preempting background or idle tasks.

### 6. Subresource Preconnect 2.0 (`preconnectCdn`)
Inspects prefetched HTML for external CDN origins (e.g., `fonts.googleapis.com`, `cdnjs.cloudflare.com`) and automatically injects:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
```
Origins are protocol-isolated (only `http:` and `https:` permitted) and capped at 20 origins per page to prevent socket saturation.

### 7. Custom Link Filter (`filter`)
A JavaScript callback function that receives the destination `URL` object and `HTMLAnchorElement`. Return `false` to prevent preloading:

```javascript
init({
    filter: (url, anchor) => {
        // Disallow preloading PDFs or admin areas
        if (url.pathname.endsWith('.pdf')) return false
        if (url.pathname.startsWith('/admin')) return false
        return true
    }
})
```

---

## Per-Link HTML Attribute Reference

You can override or augment global settings on specific `<a>` elements:

```html
<!-- 1. Explicitly mark as safe when whitelist mode is active -->
<a href="/docs" data-flash>Documentation</a>
<a href="/guides" data-instant>Guides</a>

<!-- 2. Completely exclude a link from preloading -->
<a href="/api/generate-pdf" data-no-flash>Export PDF</a>
<a href="/admin/delete" data-no-instant>Delete Account</a>

<!-- 3. Force prerender mode for instant 0ms transition -->
<a href="/pricing" data-flash-specrules="prerender">Instant Pricing</a>

<!-- 4. Explicitly assign queue priority (high, auto, low) -->
<a href="/checkout-step-1" data-flash-priority="high">Proceed to Step 1 (High Priority)</a>
<a href="/archive" data-flash-priority="low">Archive (Low Priority)</a>

<!-- 5. Per-link hover delay override in milliseconds -->
<a href="/heavy-report" data-flash-intensity="200">Heavy Report (Wait 200ms)</a>
```
