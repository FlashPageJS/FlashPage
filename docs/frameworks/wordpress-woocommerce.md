# WordPress & WooCommerce Integration Guide

Flash Page offers comprehensive support for **WordPress** and **WooCommerce**, available both as a feature-rich WordPress.org standard plugin and via lightweight manual theme integration.

---

## 1. Option A: Official WordPress Plugin (Recommended)

Flash Page includes an official WordPress plugin located at [`integrations/wordpress/flash-page/`](../../integrations/wordpress/flash-page/) and packaged as a ready-to-install zip bundle at [`dist/flash-page.zip`](../../dist/flash-page.zip).

### Installation via WordPress Admin:
1. In your WordPress dashboard, navigate to **Plugins -> Add New Plugin -> Upload Plugin**.
2. Select `dist/flash-page.zip` (available in project releases or built locally) and click **Install Now**.
3. Click **Activate Plugin**.
4. Go to **Settings -> Flash Page** to configure your options.

### Building the Plugin ZIP Locally:
You can build the production-ready plugin bundle anytime using the build script:
```bash
npm run build
# or: node ./scripts/build.js
```
This automatically minifies the latest JavaScript bundles, synchronizes them into `integrations/wordpress/flash-page/assets/`, and compiles the distribution archive at `dist/flash-page.zip`.

---

## 2. WordPress Admin Dashboard (6 Tabs)

The WordPress plugin provides an intuitive, tabbed settings interface covering all 28 library capabilities:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Flash Page Enterprise Manager v1.2.0                                   │
├───────────┬─────────────┬─────────────┬────────────┬───────────┬───────┤
│  General  │ WooCommerce │ Performance │ Exclusions │ Analytics │ Diag  │
└───────────┴─────────────┴─────────────┴────────────┴───────────┴───────┘
```

### Tab 1: General & Engine
* **Distribution Edition**: Switch between **Full Edition** (with Markov AI and subresources) and **Lite Edition** (ultra-lightweight).
* **Preload Intensity Trigger**: Choose between `65ms Hover`, `Mousedown`, `Mousedown-Only`, `Viewport`, `Viewport-All`, or `Predictive Intent Cone`.
* **Custom Hover Delay**: Adjust delay in milliseconds (default: `65ms`).
* **Speculation Rules Mode**: Select `Prefetch`, `Prerender` (instant 0ms transitions), or `Disabled`.
* **Link Boundary Scoping**: Toggle query string preloading, cross-origin links, or Whitelist Only mode.

### Tab 2: WooCommerce & E-Commerce Safeguards
* **Cart & Checkout Protection**: Automatically excludes `/cart`, `/checkout`, `/my-account`, `?add-to-cart=`, `?wc-ajax=`, and `empty-cart` endpoints.
* **Catalog Loop Add-to-Cart Guard**: Automatically appends `data-no-flash` to archive product purchase buttons.
* **Mini-Cart Shield**: Protects header mini-cart drop-down links and removal buttons (`?remove_item=`, `?undo_item=`) from speculative execution.

### Tab 3: Performance, Queue & AI
* **Prioritized Queue Scheduling**: Elevates user hover and touch interactions ahead of background or idle preloads.
* **Subresource Preconnect 2.0**: Automatically pre-resolves DNS and establishes TLS handshakes for external CDNs and Google Fonts.
* **Adaptive Concurrency**: Dynamically adjusts connection pools (1-6) based on client network quality.
* **Markov Predictive Navigation AI**: Learns visitor browsing paths locally to pre-warm likely destinations during idle time.
* **Server Backpressure Guard**: Halts prefetching automatically upon receiving HTTP 429 or 503 with `Retry-After`.

### Tab 4: Exclusions & Filters
* **Custom Path Exclusions**: Enter URL patterns to exclude (e.g. `/private-area/`, `/members/`).
* **Custom CSS Selector Exclusions**: Comma-separated CSS selectors to skip (e.g. `.no-prefetch, #user-menu a`). Matching elements are automatically tagged with `data-no-flash` on page load to shield them from speculation.
* **Excluded Post Types**: Checkboxes to disable Flash Page completely on specific post types.
* **Per-Page Meta Box**: A sidebar checkbox on every post/page editor allowing editors to disable prefetching for individual articles.

### Tab 5: Analytics & DevTools HUD
* **In-Browser DevTools HUD**: Configure visibility for `Logged-In Administrators Only`, `Everyone`, or `Disabled`. Toggle anytime with `Ctrl+Shift+F`.
* **Heatmap Isolation**: Pauses Hotjar, Microsoft Clarity, and FullStory during background prerendering.
* **Analytics Exporters**: Built-in support for Google Analytics 4, Datadog RUM, Sentry Breadcrumbs, or custom Beacon URLs.

### Tab 6: System Diagnostics
* Displays live environment status: PHP version, WordPress version, HTTPS / SSL status, WooCommerce status, and detected caching plugins (WP Rocket, LiteSpeed Cache, W3 Total Cache, WP Super Cache, Autoptimize).
* Includes a secure **Reset to Factory Defaults** button protected by WordPress nonces and capability checks.

---

## 3. WordPress Admin Bar Quick Menu

For logged-in administrators, Flash Page adds a fast diagnostic pill directly to the top WordPress Admin Toolbar:
* **Status Node**: Displays current active edition (`Full` or `Lite`).
* **Intensity Node**: Quick view of active trigger mode.
* **Speculation Mode**: Displays `PREFETCH` or `PRERENDER`.
* **Toggle In-Browser HUD**: Instant one-click toggle for the DevTools HUD overlay.
* **Settings Link**: Direct shortcut to the settings panel.

---

## 4. Option B: Manual Theme Integration (`functions.php`)

If you prefer not to use a plugin, you can integrate Flash Page directly into your child theme:

### `functions.php`:
```php
function enqueue_flash_page_script() {
    // Never run in admin, cron, or AJAX
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }

    // Exclude sensitive WooCommerce routes
    if (function_exists('is_cart') && (is_cart() || is_checkout() || is_account_page())) {
        return;
    }

    $script_url = get_stylesheet_directory_uri() . '/js/flashpage.min.js';

    wp_enqueue_script('flash-page', $script_url, array(), '1.2.0', true);

    // Provide inline configuration
    $config = array(
        'intensity' => 65,
        'specrules' => 'prerender',
        'cartSafeguards' => true,
        'priorityQueue' => true,
        'preconnectCdn' => true
    );

    wp_add_inline_script('flash-page', 'window.flashPageConfig = ' . wp_json_encode($config) . ';', 'before');
}
add_action('wp_enqueue_scripts', 'enqueue_flash_page_script');

// Set type="module" on the script tag
function add_flash_page_module_type($tag, $handle, $src) {
    if ('flash-page' === $handle) {
        return preg_replace('/<script\b/i', '<script type="module"', $tag, 1);
    }
    return $tag;
}
add_filter('script_loader_tag', 'add_flash_page_module_type', 10, 3);
```
