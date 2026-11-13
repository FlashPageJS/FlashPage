# Testing, Quality Assurance & Security Auditing

Flash Page maintains a rigorous quality assurance and automated testing pipeline spanning 6 dedicated test suites, an interactive visual testing workbench, and comprehensive worst-condition security audits.

---

## 1. Automated Test Suite Overview

All test suites run natively via Node.js with zero external runtime dependencies:

```bash
# Run all 6 test suites consecutively
npm test
```

### The 6 Core Test Suites:

| Suite Script | Command | Purpose & Coverage |
| :--- | :--- | :--- |
| [`test/comprehensiveTests.js`](../test/comprehensiveTests.js) | `node test/comprehensiveTests.js` | 50+ unit tests covering element inspection, download guards, rel guards, dataset flags, and URL normalization. |
| [`test/masterParametersTests.js`](../test/masterParametersTests.js) | `npm run test:matrix` | Exhaustive matrix test suite verifying each of the **28 Master Parameters** individually. |
| [`test/unitTests.js`](../test/unitTests.js) | `npm run test:unit` | Fast unit tests verifying queue weights, adaptive network concurrency, and telemetry exporters (GA4, Datadog, Sentry, Beacon). |
| [`test/bundleTests.js`](../test/bundleTests.js) | `npm run test:bundles` | Verifies export parity and ESM compatibility across all 4 production bundles (Full/Lite, Standard/Minified). |
| [`test/securityTests.js`](../test/securityTests.js) | `npm run test:security` | 20-part security audit covering protocol injection, CSP nonces, server backpressure, prototype pollution, and ReDoS immunity. |
| [`test/worstConditionAudit.js`](../test/worstConditionAudit.js) | `npm run test:worst` | 121-assertion worst-case stress audit testing payload injection, e-commerce cart shielding, DoS guards, rapid lifecycle cycles, and AI memory bounds. |

---

## 2. Running Individual Test Suites

### Master Parameters Matrix Tests (All 28 Parameters)
Validates that every single configuration option functions accurately across both programmatic (`init()`) and HTML dataset (`data-flash-*`) inputs:
```bash
npm run test:matrix
```

### Fast Standalone Unit Tests
Runs unit assertions covering element parsing, priority weighting, and third-party exporter isolation:
```bash
npm run test:unit
```

### Distribution Bundle Integrity & Parity
Verifies that `flashpage.js`, `flashpage.min.js`, `flashpage.lite.js`, and `flashpage.lite.min.js` export identical public APIs without syntax errors or runtime degradation:
```bash
npm run test:bundles
```

### Security & Exploit Hardening Audit
Simulates malicious user inputs and cross-origin attack vectors:
```bash
npm run test:security
```

### Worst-Case Condition & Vulnerability Stress Audit
Runs 121 exhaustive assertions testing the system under severe conditions (malicious protocol injection, rapid 25x re-initialization DOM stress, cart mutation attempts, and server backpressure):
```bash
npm run test:worst
```

---

## 3. Interactive Visual Testing Workbench

Flash Page includes a zero-dependency interactive visual testing workbench (`test/live-test.html`) served via a built-in HTTP server:

```bash
# Start the local test server on port 8085
npm run test:live
# or: node test/index.js 8085
```

Navigate to:
```text
http://127.0.0.1:8085/live
```

### Workbench Capabilities:
* **All 28 Master Parameters Control Panel**: Toggle every setting in real-time, including trigger intensity (`65`, `120`, `300`, `mousedown`, `viewport`, `intent-cone`), Speculation Rules modes (`prefetch`, `prerender`, `no`), concurrency limits, and security toggles.
* **17 Live Scenario Destination Pages**: Click real destination links to inspect live `PerformanceNavigationTiming` metrics (`Transfer Size: 0 bytes`, `Duration: 0-15 ms`) and single-click back buttons.
* **Live DOM Speculation Inspector**: Watch native `<script type="speculationrules">` JSON and `<link rel="prefetch">` tags inject and update dynamically in `document.head`.
* **Real-Time Event Stream Terminal**: Monitors live `flash:ready`, `flash:preload`, `flash:metric`, and server backpressure events with copy and clear tools.
* **Mouse Trajectory Vectoring Pad**: Live testing zone visualizing cursor coordinates, velocity (px/ms), direction vector, and target hitboxes (`/target-alpha.html`, `/target-beta.html`).
* **Burst Queue Stress Tester**: Click "Test Burst Queue" to enqueue 6 URLs at once and observe concurrency throttling in real-time.
* **Server 429 Simulation**: Trigger a simulated HTTP 429 Too Many Requests response with `Retry-After: 30` to verify automatic speculation pausing.
* **Automatic Port Fallback**: If port 8085 is occupied, the test server automatically falls back to 8086, 8087, etc.

---

## 4. Live Server HTTP Audit

To programmatically test the live HTTP server and verify that endpoints, assets, security escaping, and headers respond correctly:

```bash
# With the test server running:
node test/liveServerHttpAudit.js
```

This executes 40 automated HTTP checks against the server, validating:
* HTTP 200 responses and correct `Content-Type` headers.
* Proper HTML escaping for dynamic URLs to prevent XSS.
* HTTP 429 responses with `Retry-After` headers.
* Download links (`/archive.zip`) and static JavaScript assets.

---

## 5. Syntax Verification & Bundle Builds

### Verify JavaScript Syntax (`node --check`)
Checks all distribution files, source modules, test scripts, and build tools for syntax errors:
```bash
npm run check
```

### Build Enterprise Bundles & WordPress Plugin
Bundles ES modules, minifies code, synchronizes WordPress plugin assets, and packages `dist/flash-page.zip`:
```bash
npm run build
```

---

## 6. Node.js Compatibility Matrix

Flash Page test suites are tested and verified across modern Node.js versions:

| Node.js Version | Status | Notes |
| :--- | :---: | :--- |
| **Node 18.x** | Supported | Baseline engine support. |
| **Node 20.x** | Supported | Recommended LTS development version. |
| **Node 22.x+** | Supported | Global `navigator` getter-only property handled safely in test runners via `setMockNavigator()`. |
