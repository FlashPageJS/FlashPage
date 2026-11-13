# Markov AI Trajectory Navigation

Flash Page includes a lightweight, client-side **Markov Chain Navigation Model** that learns user browsing habits in real-time, predicting and warming the next destination during browser idle time.

---

## 1. How the Markov Model Works

A discrete-time first-order Markov chain models systems where the probability of transitioning to state $S_{t+1}$ depends solely on the current state $S_t$:

$$P(S_{t+1} = B \mid S_t = A)$$

When visitors browse your website, Flash Page tracks sequential page transitions:
1. Visitor navigates from `/products` to `/cart`.
2. Flash Page increments the transition count: `matrix['/products']['/cart'] += 1`.
3. When another visitor lands on `/products`, the engine inspects the matrix during idle time (`requestIdleCallback`).
4. If a destination surpasses a confidence threshold, Flash Page pre-warms it in the background before the user even moves their cursor.

---

## 2. Idle-Time Execution (`requestIdleCallback`)

To ensure the Markov model never competes with user interactions or critical rendering tasks, predictions run exclusively when the browser main thread is idle:

```javascript
if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
        scheduleMarkovPrediction()
    }, { timeout: 2000 })
} else {
    setTimeout(scheduleMarkovPrediction, 500)
}
```

Predicted links enter the queue at **Low Priority**, ensuring that any subsequent mouse or touch gesture immediately preempts the background task.

---

## 3. Strict Memory Capping & Bounds

To prevent unbounded storage growth in `localStorage`:
* **Path Ceiling**: Capped at a maximum of **50 distinct source paths**.
* **Destination Ceiling**: Capped at a maximum of **5 destinations** per source path.
* **Storage Footprint**: The entire transition matrix typically occupies **less than 1 KB** of client-side `localStorage`.
* **Zero Server Calls**: The matrix is computed entirely on the client. No analytics or tracking data is sent to external servers.

---

## 4. Prototype Pollution Immunity

The Markov matrix serialization and deserialization routines are hardened against prototype pollution attacks:
* Reject forbidden object keys (`__proto__`, `constructor`, `prototype`).
* Use `Object.prototype.hasOwnProperty.call()` and `Object.create(null)` dictionaries.
* Validate that parsed JSON represents a plain dictionary and not an array or corrupted structure.

---

## 5. Programmatic Querying

You can inspect the Markov model's current top prediction for any path via the exported `predictNextLink` function:

```javascript
import { predictNextLink } from 'flash-page'

const nextLikelyPage = predictNextLink(window.location.pathname)

if (nextLikelyPage) {
    console.log(`[Flash Page AI] Highest probability next route: ${nextLikelyPage}`)
}
```

To disable the Markov model entirely:
```javascript
init({ markov: false })
```
Or in HTML:
```html
<script type="module" src="/js/flashpage.min.js" data-flash-no-markov></script>
```
