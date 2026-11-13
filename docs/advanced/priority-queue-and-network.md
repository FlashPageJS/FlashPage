# Priority Queue & Network Scaling

Flash Page includes a multi-tiered priority queue and dynamic network concurrency engine designed to maximize preload hit rates while strictly eliminating network congestion and main-thread contention.

---

## 1. Prioritized Queue Architecture

Standard browser prefetch implementations treat all background requests uniformly. Flash Page categorizes all speculative actions into three distinct priority lanes:

```text
               ┌────────────────────────────────────────────────────────┐
               │              Flash Page Priority Queue                 │
               └────────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────┐
         ▼                                 ▼                             ▼
   [High Priority]                  [Auto Priority]               [Low Priority]
         │                                 │                             │
 • pointerdown gesture              • Standard 65ms hover         • Markov AI predictions
 • Explicit intentional hover       • Viewport scroll links       • Subresource asset warming
 • data-flash-priority="high"       • Intent cone velocity        • Background idle tasks
```

### Queue Preemption Logic:
Whenever an active user interaction occurs (e.g. cursor moves over an anchor or fingers touch the screen), that request is classified as **High Priority**. It immediately bypasses pending low-priority background tasks, ensuring that real-time human intent always takes precedence.

---

## 2. Adaptive Concurrency Scaling

By default, Flash Page caps simultaneous in-flight speculative requests to `maxConcurrent: 3`. When `adaptiveConcurrency: true` is enabled, Flash Page actively inspects the browser's **Network Information API** (`navigator.connection`) and dynamically adjusts concurrency limits:

| Effective Connection Type | Round-Trip Time (RTT) | Downlink Bandwidth | Dynamic Concurrency Limit |
| :--- | :---: | :---: | :---: |
| **High-Speed Fiber / 5G / 4G** | `< 100ms` | `> 5.0 Mbps` | **6 Connections** |
| **Standard 4G** | `100ms - 250ms` | `2.0 - 5.0 Mbps` | **4 Connections** |
| **3G / Moderate Mobile** | `250ms - 500ms` | `0.5 - 2.0 Mbps` | **2 Connections** |
| **Slow 2G / Poor Signal** | `> 500ms` | `< 0.5 Mbps` | **Halted (0 Connections)** |

```javascript
import { init } from 'flash-page'

init({
    adaptiveConcurrency: true,
    maxConcurrent: 4 // Acts as upper ceiling
})
```

---

## 3. Subresource Preconnect 2.0

When an HTML document is speculatively pre-fetched, Flash Page's HTML tokenizer quickly parses critical external asset origins referenced within `<link>` tags:
* Google Web Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
* Public CDNs (`cdnjs.cloudflare.com`, `cdn.jsdelivr.net`)
* Asset CDNs and image hostnames

Flash Page immediately establishes early socket handshakes by injecting:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
```

### Safety & Socket Protection:
1. **Protocol Isolation**: Only `http:` and `https:` origins are accepted. Potentially malicious schemes (`javascript:`, `data:`, `file:`) are strictly rejected.
2. **Connection Cap**: Preconnected origins are capped at **20 unique origins** per page to prevent browser socket exhaustion and ephemeral port exhaustion.
3. **Deduplication**: Active origins are cached in an internal Set so duplicate tags are never appended.
