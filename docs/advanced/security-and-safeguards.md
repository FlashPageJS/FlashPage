# Security, Privacy & Health Safeguards

Flash Page incorporates enterprise-grade security hardening and resource boundaries to guarantee that speculative prefetching never executes destructive operations, leaks sensitive data, or overwhelms backend servers.

---

## 1. E-Commerce Cart & Mutation Safeguards

Speculative prefetching must never trigger accidental cart mutations, checkout sequences, or payment authorizations. When `cartSafeguards: true` is active (default), Flash Page permanently blocks preloading on:

### Protected Path Patterns:
* `/cart`, `/checkout`, `/basket`, `/bag`
* `/order`, `/orders`, `/my-account`, `/customer/account`

### Protected Query Strings:
* `?add-to-cart=`
* `?wc-ajax=`
* `?empty-cart=`
* `?remove_item=`
* `?undo_item=`
* `?cart_action=`

### Protected Button & Form Classes:
* `.add_to_cart_button`
* `[data-cart-action]`
* `[data-add-to-cart]`
* `[data-no-flash]`

---

## 2. Server Backpressure & Auto-Backoff (429 / 503)

If your origin server or reverse proxy experiences heavy traffic spikes, Flash Page automatically protects backend infrastructure:

1. When a speculative background request encounters an HTTP **429 (Too Many Requests)** or **503 (Service Unavailable)** response, Flash Page intercepts the status code.
2. It parses the standard HTTP `Retry-After` header (handling both integer seconds and HTTP dates).
3. If no header is present, it defaults to **30 seconds** of cooldown, safety-capped at **300 seconds (5 minutes)**.
4. All speculative prefetching across the entire origin is immediately halted.
5. Normal prefetching resumes automatically when the backpressure window expires.

You can inspect backpressure status programmatically:
```javascript
import { isServerHealthy, status } from 'flash-page'

if (!isServerHealthy()) {
    console.warn('Server under backpressure. Preloading suspended.')
}
```

---

## 3. Device & Battery Awareness

Flash Page respects user battery life and cellular data limits:

* **Save-Data Header**: If `navigator.connection.saveData` is `true`, prefetching halts immediately.
* **Slow 2G Networks**: On slow 2G connections, speculative prefetching is suspended to avoid consuming high-latency cellular buffers.
* **Low Battery Guard**: If the device battery level drops below **20%** while actively discharging, prefetching is paused.
* **Low Memory Guard**: On mobile devices with $\le 1\text{ GB}$ of RAM (`navigator.deviceMemory`), speculation is disabled.

---

## 4. Multi-Pass Percent-Encoding Evasion Defense

Attackers sometimes attempt to bypass prefetch filters by double-encoding sensitive paths (e.g. `/%2564elete` or `/%2563art`).

Flash Page executes a recursive, multi-pass URI decoding algorithm (`safeDecodeURI`) across both pathnames and query strings. It normalizes all percent-encoded representations before evaluating blacklist filters, neutralizing evasion attempts.

---

## 5. CSP Nonce Sanitization & Script Escaping

When injecting native Speculation Rules:
1. **CSP Nonce Support**: If a CSP nonce is provided (`nonce: '...'` or `data-flash-nonce`), Flash Page validates the string against strict alphanumeric standards (`^[A-Za-z0-9+/=_-]+$`), rejecting any attempt at attribute breakout.
2. **Script Closing Tag Escaping**: Speculation rules JSON strings automatically escape `</script` sequences (`replace(/<\/script/gi, '<\\/script')`), preventing inline script injection.

---

## 6. DOM Accumulation & Memory Safety

In long-running Single Page Applications (Next.js, Nuxt, SvelteKit), repeatedly appending `<link>` or `<script>` tags can leak memory over time.

Flash Page enforces strict FIFO rolling window caps:
* **Speculation List Rules**: Capped at a maximum of **20 active script nodes**.
* **Link Prefetch Tags**: Capped at a maximum of **25 active link elements**.
* Older nodes are cleanly removed from `document.head` as newer ones arrive.
