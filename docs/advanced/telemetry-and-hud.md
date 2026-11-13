# DevTools HUD & Telemetry

Flash Page includes a real-time, in-browser **DevTools HUD overlay** and a comprehensive **telemetry measurement pipeline** to verify prefetch efficiency and track conversion rates.

---

## 1. In-Browser DevTools HUD Overlay

The Flash Page HUD provides instant visual feedback directly in the browser window without requiring browser extension installations.

```text
┌────────────────────────────────────────────────────────┐
│ ⚡ Flash Page DevTools HUD                     [×]     │
├────────────────────────────────────────────────────────┤
│ Engine: Native Speculation Rules (Document)            │
│ Status: Optimal (0ms Latency)                          │
│ Active Queue: 0 in-flight | 2 completed                │
│ Server Health: Healthy (HTTP 200 OK)                   │
│                                                        │
│ [x] Highlight Preloaded Anchors (Cyan Glow)            │
└────────────────────────────────────────────────────────┘
```

### How to Toggle the HUD:
1. Ensure `hud: true` or `data-flash-hud` is enabled in your configuration.
2. Press **`Ctrl + Shift + F`** on your keyboard (on macOS: `Cmd + Shift + F` or `Ctrl + Shift + F`).
3. On touchscreens and mobile devices, tap the screen **4 times with three fingers simultaneously**.

### Visual Link Highlighting:
When active, links that have been successfully preloaded or prerendered highlight with a luminous **cyan outline and subtle glow**:
```css
a[data-flash-preloaded] {
    outline: 2px solid #00f0ff;
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
}
```

---

## 2. Navigation Metrics & Telemetry Events

Flash Page tracks the entire lifecycle of speculative preloads:
1. When a preload is initiated, it records `{ url, time: Date.now() }` in `sessionStorage`.
2. When the user navigates, it compares `PerformanceNavigationTiming` timestamps.
3. It computes the **saved duration** (the difference between initial click intent and document arrival).

### Listening to Custom DOM Events:
```javascript
window.addEventListener('flash:metric', (event) => {
    const { url, converted, wasPrerendered, lcpSavedMs, duration } = event.detail
    
    console.log(`[Flash Page Metric] Navigated to: ${url}`)
    console.log(`  Converted from Preload: ${converted}`)
    console.log(`  Was Prerendered: ${wasPrerendered}`)
    console.log(`  LCP Saved: ${lcpSavedMs}ms (Navigation Duration: ${duration}ms)`)
})
```

### Using the `onMetric` Callback:
```javascript
import { init } from 'flash-page'

init({
    onMetric: (metric) => {
        // Send to your internal data warehouse
        fetch('/api/performance', {
            method: 'POST',
            body: JSON.stringify(metric),
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
```

---

## 3. Built-In Analytics Exporters

Flash Page includes built-in telemetry adapters that dispatch metrics automatically to third-party APM and analytics platforms.

### Option A: Google Analytics 4 (`analytics: 'ga4'`)
Automatically dispatches a custom GA4 event using global `gtag()`:
```javascript
init({ analytics: 'ga4' })
```
Dispatches event:
```javascript
gtag('event', 'flash_navigation', {
    page_location: metric.url,
    converted: metric.converted,
    was_prerendered: metric.wasPrerendered,
    lcp_saved_ms: metric.lcpSavedMs,
    value: metric.lcpSavedMs
})
```

### Option B: Datadog RUM (`analytics: 'datadog'`)
Dispatches custom actions to Datadog RUM:
```javascript
init({ analytics: 'datadog' })
```
Dispatches action:
```javascript
window.DD_RUM.addAction('flash_navigation', metric)
```

### Option C: Sentry Breadcrumbs (`analytics: 'sentry'`)
Records user navigation speed as Sentry breadcrumbs:
```javascript
init({ analytics: 'sentry' })
```
Records breadcrumb:
```javascript
window.Sentry.addBreadcrumb({
    category: 'flash.navigation',
    message: `Flash navigation: ${metric.url} (prerendered: ${metric.wasPrerendered})`,
    data: metric,
    level: 'info'
})
```

### Option D: Telemetry Beacon URL (`beaconUrl`)
Sends compact JSON payloads via `navigator.sendBeacon` upon navigation without blocking page teardown:
```javascript
init({
    beaconUrl: 'https://telemetry.example.com/api/v1/metrics'
})
```

---

## 4. Heatmap & Session Replay Isolation

Prerendering a page in the background can distort session replay recordings (e.g. Hotjar, Microsoft Clarity, FullStory) by creating phantom user sessions.

When `isolateHeatmaps: true` is active (default), Flash Page automatically detects whether the current document is in a background prerendering state:
```javascript
if (document.prerendering) {
    // Pauses session recording until the user actually activates the page
}
```
Normal recording resumes automatically as soon as the user activates the tab.
