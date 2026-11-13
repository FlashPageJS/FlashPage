# Flash Page Documentation Hub

Welcome to the official documentation for **Flash Page (v1.2.0)** - the enterprise-grade speculative prefetching and native Speculation Rules manager.

Flash Page eliminates perceived page load latency (down to 0ms) by intelligently prefetching or prerendering destination pages before the user completes a click or tap gesture.

---

## Documentation Directory

### 1. Core Guides & Reference
* [Getting Started Guide](./getting-started.md): Installation options (NPM, CDN, Self-Hosted), quickstart examples, and core concepts.
* [Configuration Reference](./configuration-reference.md): Complete matrix of all 28 configuration options, dataset attributes, and per-link controls.
* [Programmatic API Reference](./api-reference.md): Detailed reference for exported JavaScript functions and TypeScript definitions.
* [Architecture & Speculation Engines](./architecture-and-engines.md): Multi-engine hierarchy (Speculation Rules, Link Prefetch, Safari WebKit Cache Warming), lifecycle, and DOM observer.

### 2. Framework Ecosystem Adapters
* [React & Next.js Guide](./frameworks/react-nextjs.md): `useFlashPage` hook, `createFlashLink` factory, `<FlashLink>` component, Next.js 14/15 App Router, and Pages Router.
* [Vue 3 & Nuxt 3 Guide](./frameworks/vue-nuxt.md): `v-flash` directive, `useFlash` composable, and Nuxt 3 client plugins.
* [Svelte 5 & SvelteKit Guide](./frameworks/svelte-sveltekit.md): `use:flashAction` action, Svelte 5 Runes, and root layout integration.
* [Astro Integration Guide](./frameworks/astro.md): `setupAstroTransitions` lifecycle adapter and Astro View Transitions coordination.
* [WordPress & WooCommerce Guide](./frameworks/wordpress-woocommerce.md): Official plugin administration, theme helpers, and WooCommerce cart safeguards.
* [Shopify Guide](./frameworks/shopify.md): Liquid theme integration, product grid prefetching, and cart drawer protection.
* [Laravel & Livewire Guide](./frameworks/laravel-blade.md): Blade directives, `@vite` assets, and Livewire 3 `wire:navigate` compatibility.
* [Django & Jinja Guide](./frameworks/django-jinja.md): Base template integration, custom template tags, and CSRF protection.
* [HTMX, Alpine.js & Turbo Guide](./frameworks/htmx-alpine-turbo.md): Coexistence with `hx-boost`, reactive directives, and Turbo drive navigations.

### 3. Advanced Capabilities
* [Priority Queue & Network Scaling](./advanced/priority-queue-and-network.md): Prioritized queue scheduling, adaptive network concurrency, and CDN preconnect 2.0.
* [Markov AI Trajectory Navigation](./advanced/markov-ai-prediction.md): Client-side transition matrix, idle-time predictions, and memory capping.
* [Security, Privacy & Health Safeguards](./advanced/security-and-safeguards.md): Cart mutation shields, HTTP 429/503 backpressure backoff, battery guards, and Data Saver.
* [DevTools HUD & Telemetry](./advanced/telemetry-and-hud.md): In-browser diagnostic overlay (`Ctrl+Shift+F`), conversion metrics, and GA4 / Datadog / Sentry exporters.

### 4. Migration Guides
* [Migrating from instant.page](./migration/from-instant-page.md): 1-minute drop-in upgrade path and dataset attribute mapping.
* [Migrating from Quicklink](./migration/from-quicklink.md): Moving from viewport-heavy fetching to user-intent speculation.

### 5. Development & Testing
* [Testing, QA & Security Auditing](./testing-and-auditing.md): Guide to running all 6 test suites, the 121-assertion worst-condition security audit, live visual test workbench (`http://127.0.0.1:8085/live`), and build scripts.

---

## Universal Distribution Editions

Flash Page distributes two distinct bundles to fit different application profiles:

| Feature / Capability | Full Edition (`flashpage.js`) | Lite Edition (`flashpage.lite.js`) |
| :--- | :---: | :---: |
| **Minified Size** | 42 KB min (11.5 KB gzip) | 30 KB min (8.2 KB gzip) |
| **Speculation Rules (Document & List Rules)** | Yes | Yes |
| **Link Prefetch Fallback** | Yes | Yes |
| **Safari WebKit Fetch Warming** | Yes | Yes |
| **Intent Cone Physics & Trajectory** | Yes | Yes |
| **Priority Queue & Concurrency Limiter** | Yes | Yes |
| **WooCommerce & Cart Mutation Safeguards** | Yes | Yes |
| **Server Backpressure (429 / 503 Auto-Backoff)** | Yes | Yes |
| **Device Constraints (Battery, Save-Data, 2G)** | Yes | Yes |
| **Framework Adapters (React, Vue, Svelte, Astro)** | Yes | Yes |
| **Critical Subresource (CSS/Font) Pre-warming** | Yes | No |
| **Subresource CDN Preconnect 2.0** | Yes | No |
| **Markov AI Predictive Trajectory** | Yes | No |
| **Heatmap & Session Replay Isolation** | Yes | No |
| **DevTools HUD Overlay (`Ctrl+Shift+F`)** | Yes | No |
| **Telemetry Exporters (GA4, Datadog, Sentry, Beacon)** | Yes | No |

---

## Browser Support Matrix

Flash Page is designed to run in every modern browser with automatic progressive enhancement:

| Browser Family | Minimum Version | Active Engine | Resulting User Experience |
| :--- | :---: | :---: | :--- |
| **Google Chrome** | 121+ | Native Speculation Rules | Instantaneous 0ms page loads via in-memory prerender/prefetch |
| **Microsoft Edge** | 121+ | Native Speculation Rules | Instantaneous 0ms page loads |
| **Opera** | 107+ | Native Speculation Rules | Instantaneous 0ms page loads |
| **Mozilla Firefox** | 80+ | `<link rel="prefetch">` | Accelerated document caching via browser disk/memory cache |
| **Apple Safari (macOS & iOS)** | 14+ | Low-priority `fetch()` warming | Warmed HTTP cache for same-origin document routes |
| **Mobile Browsers** | Modern | Hardware-Aware Engine | Automatically respects battery and Save-Data constraints |
