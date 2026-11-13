# Architecture & Speculation Engines

Flash Page uses a modular, multi-tier execution architecture to deliver instant page loads across all modern browser engines while maintaining strict zero-regressive resource guarantees.

---

## 1. Engine Hierarchy & Detection

When initialized, Flash Page automatically evaluates browser capabilities and activates the most efficient speculation engine available:

```text
                        ┌─────────────────────────────────┐
                        │   Browser Feature Detection     │
                        └────────────────┬────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
      [Chromium 121+ Engine]     [Firefox / Standards]     [Safari / WebKit]
                 │                       │                       │
      HTMLScriptElement.supports         │                       │
        ('speculationrules')             │                       │
                 │                       │                       │
                 ▼                       ▼                       ▼
      Native Speculation Rules   <link rel="prefetch">   Low-Priority fetch()
       (Document & List Rules)       as="document"           Cache Warming
```

### Tier 1: Native Speculation Rules (Chrome, Edge, Opera 121+)
In Chromium 121+, Flash Page injects a declarative `<script type="speculationrules">` element into the document head containing native **Document Rules**. This instructs the Chromium C++ rendering engine to handle speculation out-of-process, bypassing the main JavaScript thread entirely during navigation.

Document Rules automatically inherit your exclusion selectors and e-commerce cart safeguards:
```json
{
  "prefetch": [
    {
      "source": "document",
      "where": {
        "and": [
          { "href_matches": "/*" },
          {
            "not": {
              "selector_matches": [
                "[rel~=nofollow]",
                "[data-no-flash]",
                "[download]",
                "a[href*='/cart']",
                "a[href*='/checkout']"
              ]
            }
          }
        ]
      },
      "eagerness": "moderate"
    }
  ]
}
```

When specific user gestures occur (hover, touch, or trajectory targeting), Flash Page dynamically injects on-demand **List Rules** for target URLs. Injected list rule scripts are automatically tracked in a rolling window capped at 20 elements to prevent DOM bloat in long-lived Single Page Applications.

### Tier 2: Standard Link Prefetch (Mozilla Firefox & Standards)
For browsers that support document prefetching via link tags (Firefox, older Chrome), Flash Page dynamically creates and appends:
```html
<link rel="prefetch" href="/pricing" as="document" fetchpriority="low">
```
Active link nodes are monitored in a rolling FIFO array capped at 25 elements, automatically recycling older tags to keep DOM tree overhead minimal.

### Tier 3: Safari / WebKit Cache Warming
Apple Safari and iOS WebKit do not support `<link rel="prefetch">` for documents. Flash Page provides an automated fallback (`safariFallback: true`) that issues a low-priority background `fetch()` with credentials and `mode: 'no-cors'`:
```javascript
fetch(url, {
    priority: 'low',
    credentials: 'same-origin',
    headers: { 'Purpose': 'prefetch', 'Sec-Purpose': 'prefetch' }
})
```
This primes the Safari HTTP disk cache so that when the user clicks the link, the HTML document is served directly from local cache.

---

## 2. Input Subsystem & Physics Engine

```text
User Actions ──► [Pointer Events] ──► [Intent Cone Physics] ──► [Priority Queue]
                 (pointerover / down) (velocity vector + angle)  (High / Auto / Low)
```

1. **Unified Pointer Events**: Flash Page uses `pointerover` and `pointerdown` rather than legacy mouse or touch events. This automatically handles touchscreens, stylus pens, and mice with hardware accuracy (`event.pointerType`).
2. **Intent Cone Physics**: During cursor movement, Flash Page samples cursor coordinates across a sliding 3-point window to calculate movement velocity ($v = \Delta d / \Delta t$) and direction vector $\vec{v}$. If the trajectory vector intersects an anchor bounding rectangle within a 30-degree cone, prefetching triggers immediately before hover begins.
3. **Infinite Feeds & Dynamic SPAs**: A built-in `MutationObserver` watches `document.body` for newly added DOM nodes (such as client-side route changes, infinite scroll feeds, or modal dialogs), binding listeners instantly without requiring manual re-initialization.

---

## 3. Concurrency Control & Priority Queue

To prevent network congestion or contention with critical user assets (images, fonts, API calls), all speculative requests flow through the **Priority Queue**:

* **High Priority Queue**: Pointer interactions (`pointerdown` and intentional hover) jump directly to the head of the queue.
* **Auto Priority Queue**: Viewport preloads and general intent triggers.
* **Low Priority Queue**: Markov AI predictions and subresource warming.

Active in-flight requests are capped at `maxConcurrent: 3` (or scaled dynamically from 1 to 6 connections via `adaptiveConcurrency` depending on the client connection type).

---

## 4. Teardown & Lifecycle Cleanup

When `destroy()` is called:
* All event listeners on `window` and `document` are removed.
* Active `AbortController` signals terminate in-flight event processing.
* The `MutationObserver` and `IntersectionObserver` instances disconnect.
* Injected Speculation Rules and `<link>` elements are flushed from `document.head`.
* The priority queue is cleared.
