# Getting Started with Flash Page

This guide will walk you through installing, configuring, and verifying **Flash Page** in your web application.

---

## 1. Installation Options

You can install Flash Page through your preferred package manager, via high-speed global CDNs, or by self-hosting the standalone scripts.

### Option A: NPM / Yarn / PNPM (Recommended for Modern Stacks)

Install the package into your project:

```bash
# npm
npm install flash-page

# yarn
yarn add flash-page

# pnpm
pnpm add flash-page
```

### Option B: High-Speed Global CDN (Recommended for Static Sites & CMS)

Add the script tag before the closing `</body>` tag of your HTML document:

#### Full Edition (With Markov AI, DevTools HUD, and Subresource Warming):
```html
<script type="module" src="https://cdn.jsdelivr.net/npm/flash-page@1.2.1/flashpage.min.js"></script>
```

#### Lite Edition (Ultra-lean, zero UI, core speculation only):
```html
<script type="module" src="https://cdn.jsdelivr.net/npm/flash-page@1.2.1/flashpage.lite.min.js"></script>
```

### Option C: Self-Hosted Direct Download

Download `flashpage.min.js` directly from the repository or releases, place it in your static assets folder (e.g. `/public/js/`), and load it:

```html
<script type="module" src="/js/flashpage.min.js"></script>
```

---

## 2. Quickstart & Initialization

### Method 1: Zero-Config Auto-Initialization (CDN / Script Tag)

When loaded via a standard `<script type="module">` tag, Flash Page automatically initializes itself with production-grade defaults:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Fast Website</title>
</head>
<body>
    <nav>
        <a href="/about">About Us</a>
        <a href="/products">Products</a>
        <a href="/pricing">Pricing</a>
    </nav>

    <!-- Flash Page script tag before body close -->
    <script type="module" src="/js/flashpage.min.js"></script>
</body>
</html>
```

### Method 2: Programmatic Initialization (ES Modules / Bundlers)

In Vite, Webpack, Next.js, Nuxt, Astro, or SvelteKit, import `init` and execute it in client-side code:

```javascript
import { init } from 'flash-page'

// Initialize on page load
init({
    intensity: 65,            // Trigger preload after 65ms hover
    specrules: 'prerender',   // Use 0ms instant prerendering where supported
    cartSafeguards: true,     // Protect cart and checkout routes
    priorityQueue: true,      // Elevate hovered links above idle links
    debug: false              // Enable console logging for development
})
```

To use the ultra-lightweight Lite Edition in your bundler:

```javascript
import { init } from 'flash-page/lite'

init({
    intensity: 65,
    specrules: 'prefetch'
})
```

---

## 3. Configuring via HTML Dataset Attributes

If you load Flash Page via `<script type="module">`, you can configure any parameter directly on the `<script>` tag or the `<body>` element without writing any JavaScript:

```html
<script 
    type="module" 
    src="/js/flashpage.min.js"
    data-flash-intensity="65"
    data-flash-specrules="prerender"
    data-flash-allow-query-string
    data-flash-hud
></script>
```

Or on the `<body>` element:

```html
<body 
    data-flash-intensity="mousedown" 
    data-flash-cart-safeguards
>
    <!-- Page Content -->
</body>
```

---

## 4. How to Verify Flash Page is Working

### Step 1: Open Chrome DevTools Network Tab
1. Open your website in Google Chrome or Microsoft Edge.
2. Open Developer Tools (`F12` or `Ctrl+Shift+I` / `Cmd+Option+I`).
3. Switch to the **Network** tab and check the **Preserve log** checkbox.
4. Filter by **Doc** (documents).
5. Hover over any internal navigation link for 65 milliseconds.
6. You will see an immediate network entry for that destination document before you click!

### Step 2: In-Browser DevTools HUD Overlay
If you enabled the HUD (`hud: true` or `data-flash-hud`), press **`Ctrl + Shift + F`** on your keyboard (or tap 4 times with three fingers on mobile devices). A sleek real-time diagnostic panel will appear in the lower-right corner showing:
* **Engine**: `document-rules`, `speculation-list`, `link`, or `fetch`
* **Queue Depth**: Number of active and queued preload requests
* **Server Status**: Green when server health is optimal, orange when backpressure backoff is active
* **Visual Glow**: Preloaded links on the page will highlight with a soft cyan glow

---

## 5. Basic Per-Link Overrides

You can control Flash Page on specific links using standard HTML data attributes:

```html
<!-- Force prerendering on a high-value link -->
<a href="/pricing" data-flash-specrules="prerender">View Pricing (0ms Instant)</a>

<!-- Assign high priority in the queue -->
<a href="/signup" data-flash-priority="high">Sign Up Now</a>

<!-- Explicitly exclude a link from ever being preloaded -->
<a href="/logout" data-no-flash>Sign Out</a>

<!-- Explicitly opt-in a link when whitelist mode is enabled -->
<a href="/docs" data-flash>Read Documentation</a>
```

---

## 4. Local Verification & Testing

Flash Page provides an interactive visual workbench and automated test runners to verify prefetching behavior before deploying:

```bash
# Start the local interactive test server
npm run test:live
# Open http://127.0.0.1:8085/live

# Run all 6 automated test suites
npm test
```

For full testing instructions and security audit details, see the [Testing & Auditing Guide](./testing-and-auditing.md).

---

## Next Steps

* Explore the [Configuration Reference](./configuration-reference.md) for details on all 28 parameters.
* Review the [Programmatic API Reference](./api-reference.md) for runtime status and queue methods.
* Read the [Testing & Auditing Guide](./testing-and-auditing.md) for QA and verification workflows.
* Read the framework guide specific to your project:
  * [React & Next.js](./frameworks/react-nextjs.md)
  * [Vue & Nuxt](./frameworks/vue-nuxt.md)
  * [Svelte & SvelteKit](./frameworks/svelte-sveltekit.md)
  * [Astro](./frameworks/astro.md)
  * [WordPress & WooCommerce](./frameworks/wordpress-woocommerce.md)
