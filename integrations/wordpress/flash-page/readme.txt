=== Flash Page ===
Contributors: wpamitkumar
Tags: prefetch, prerender, speculation rules, performance, speed, woocommerce
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.2.1
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Enterprise Speculation Rules and Smart Prefetching for WordPress and WooCommerce.

== Description ==

Flash Page makes your WordPress pages load instantly (0ms perceived latency) by speculatively prefetching and prerendering pages before users click.

By leveraging the cutting-edge **Speculation Rules API** (Chrome, Edge, and Opera 121+) alongside an intelligent prioritized queue and e-commerce cart safeguards, Flash Page delivers instant page loads without crashing servers or causing phantom basket items.

### Key Capabilities

* **Native Speculation Rules API**: Uses modern browser prerendering for instantaneous 0ms page transitions.
* **WooCommerce & E-Commerce Safeguards**: Automatically protects `/cart`, `/checkout`, `/my-account`, `?add-to-cart=`, and add-to-cart buttons against accidental background execution.
* **Prioritized Queue Scheduling**: User interactions (hover, click start) jump immediately ahead of idle or viewport preloads.
* **Subresource Preconnect 2.0**: Automatically pre-resolves DNS and establishes TCP/TLS handshakes for external CDNs and Google Fonts.
* **Markov Predictive Navigation AI**: Learns user navigation habits to pre-warm the next most likely page during idle time.
* **Server Backpressure & Auto-Backoff**: Automatically suspends prefetching for 30s to 300s upon receiving HTTP 429 Too Many Requests or 503 Service Unavailable with Retry-After.
* **Device & Battery Constraints**: Automatically suspends preloading when browser Data Saver is on, on slow 2G connections, or when battery level drops below 20%.
* **Heatmap & Analytics Isolation**: Automatically pauses Hotjar, Microsoft Clarity, and FullStory during background prerendering to prevent skewed metrics and ghost sessions.
* **Administrator DevTools HUD**: Real-time in-browser queue depth, engine diagnostics, and glowing cyan link highlights. Toggle with `Ctrl+Shift+F`.
* **WP Admin Bar Status Pill**: Fast overview and engine toggle directly from the top WordPress toolbar.

== Installation ==

1. Upload the `flash-page` folder to your `/wp-content/plugins/` directory, or install directly through the WordPress Plugins dashboard.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Navigate to **Settings -> Flash Page** to customize your preloading intensity, WooCommerce protection, and performance options.

== Frequently Asked Questions ==

= Does Flash Page work with caching plugins like WP Rocket or LiteSpeed? =
Yes. Flash Page works seamlessly alongside all page caching plugins (WP Rocket, LiteSpeed Cache, W3 Total Cache, WP Super Cache, Cloudflare, Fastly). It accelerates the delivery of already-cached HTML directly into the user's browser.

= Will Flash Page increase my server load? =
Flash Page includes adaptive concurrency (1-6 connections), server backpressure detection (HTTP 429/503 backoff), and battery/data-saver guards. It only preloads high-intent links that visitors are likely to visit.

= Is WooCommerce supported? =
Yes. Flash Page has built-in e-commerce safeguards that automatically detect and exclude `/cart`, `/checkout`, `/my-account`, and `?add-to-cart=` endpoints to prevent accidental item additions.

= Which browsers support native Speculation Rules? =
Google Chrome, Microsoft Edge, and Opera (version 121+) natively support Speculation Rules. For Safari, Firefox, and older browsers, Flash Page automatically falls back to standard `link rel=prefetch` or low-priority background fetch.

== Screenshots ==

1. Flash Page General & Engine settings tab.
2. WooCommerce & E-Commerce mutation safeguards tab.
3. Queue scheduling, adaptive network concurrency, and Markov AI options.
4. Custom path and post-type exclusions tab.
5. In-browser real-time DevTools HUD overlay.

== Changelog ==

= 1.2.1 =
* Maintenance update: Synchronized asset bundles and definitions with v1.2.1 release.

= 1.2.0 =
* Initial official WordPress release.
* Added native Speculation Rules prefetch and prerender modes.
* Added E-Commerce Cart Safeguards for WooCommerce.
* Added Prioritized Queue Scheduling and Subresource Preconnect 2.0.
* Added In-Browser DevTools HUD and WP Admin Bar quick status menu.
* Full WordPress.org coding standard compliance, strict sanitization, and i18n localization.

== Upgrade Notice ==

= 1.2.0 =
Initial release of Flash Page for WordPress. Upgrade to enable instant Speculation Rules prefetching and WooCommerce protection.
