# Migrating from instant.page

Flash Page is designed as a **100% backward-compatible, drop-in replacement** for `instant.page`. Upgrading takes under one minute and requires zero markup refactoring.

---

## 1. Why Upgrade from instant.page?

While `instant.page` pioneered hover prefetching via `<link rel="prefetch">`, modern browsers have evolved significantly:

| Capability | instant.page (v5.2.0) | Flash Page (v1.2.0) |
| :--- | :---: | :---: |
| **Native Speculation Rules API (Chrome/Edge 121+)** | No | **Yes (0ms Instant)** |
| **Full Background Prerender (Instant Display)** | No | **Yes** |
| **WooCommerce & Cart Mutation Safeguards** | No | **Yes (Built-In)** |
| **Server Backpressure & 429/503 Protection** | No | **Yes** |
| **Prioritized Queue Scheduling** | No | **Yes (3 Priority Lanes)** |
| **Adaptive Concurrency (Network Information API)** | No | **Yes (1-6 Pools)** |
| **Subresource Preconnect 2.0 (CDN Fonts & CSS)** | No | **Yes** |
| **Markov AI Trajectory Model** | No | **Yes** |
| **In-Browser DevTools HUD Overlay** | No | **Yes (`Ctrl+Shift+F`)** |
| **Apple Safari / WebKit Cache Warming Fallback** | Partial | **Yes (Low-Priority Fetch)** |
| **Framework Adapters (React, Vue, Svelte, Astro)** | None | **Yes (First-Class Hooks)** |

---

## 2. 1-Minute Drop-In Migration

### Step 1: Replace the Script Tag

#### Before (`instant.page`):
```html
<script src="//instant.page/5.2.0" type="module" integrity="sha384-..." crossorigin="anonymous"></script>
```

#### After (Flash Page):
```html
<script src="https://cdn.jsdelivr.net/npm/flash-page@1.2.0/flashpage.min.js" type="module"></script>
```

That is it! Your website is now running Flash Page with native Speculation Rules and cart safeguards.

---

## 3. Full Backwards Compatibility

Flash Page natively honors all legacy `instant.page` dataset attributes. You do not need to update existing HTML tags:

| Legacy instant.page Attribute | Native Flash Page Equivalent | Behavior |
| :--- | :--- | :--- |
| `data-instant-intensity="mousedown"` | `data-flash-intensity="mousedown"` | Initiates prefetch on pointer touch/down. |
| `data-instant-intensity="viewport"` | `data-flash-intensity="viewport"` | Preloads links entering mobile viewports. |
| `data-instant-allow-query-string` | `data-flash-allow-query-string` | Permits URLs with query parameters. |
| `data-instant-allow-external-links` | `data-flash-allow-external-links` | Permits cross-origin links. |
| `data-instant-whitelist` | `data-flash-whitelist` | Operates in whitelist-only mode. |
| `<a href="..." data-instant>` | `<a href="..." data-flash>` | Explicitly opts in a link. |
| `<a href="..." data-no-instant>` | `<a href="..." data-no-flash>` | Completely excludes a link. |

---

## 4. Verification

After replacing the script:
1. Open Chrome DevTools (`F12`).
2. Press **`Ctrl + Shift + F`** to toggle the Flash Page DevTools HUD.
3. Hover over an internal link to see the native Speculation Rules engine in action.
