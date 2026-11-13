# HTMX, Alpine.js & Turbo Integration Guide

Flash Page provides zero-friction compatibility with hypermedia-driven stacks, modern reactive HTML libraries, and Hotwire architectures including **HTMX**, **Alpine.js**, and **Turbo (Hotwire)**.

---

## 1. HTMX Integration

HTMX delivers dynamic Single Page Application feel directly through HTML attributes. Flash Page is specifically designed to work harmoniously alongside HTMX:

### Automatic HTMX Protection:
Flash Page natively detects and ignores any element possessing HTMX operational attributes:
* `[hx-get]`, `[hx-post]`, `[hx-put]`, `[hx-delete]`, `[hx-patch]`
* `[hx-target]`, `[hx-swap]`

This ensures that partial HTML fragments, sub-component replacements, and destructive backend operations are never accidentally preloaded as full documents.

### Synergy with `hx-boost="true"`:
When using `hx-boost` for accelerated page navigations, Flash Page pre-warms the destination document in cache before the click, allowing HTMX to swap the `<body>` instantly with 0ms delay:

```html
<!-- Whole page boosted by HTMX -->
<body hx-boost="true">
    <nav>
        <!-- Flash Page prewarms document cache; HTMX swaps body instantly on click -->
        <a href="/dashboard">Dashboard</a>
        <a href="/reports">Reports</a>

        <!-- Partial component endpoint: Automatically ignored by Flash Page -->
        <button hx-get="/api/user-menu" hx-target="#menu-container">
            Open Menu
        </button>
    </nav>
    <div id="menu-container"></div>

    <script type="module" src="/js/flashpage.min.js"></script>
</body>
```

---

## 2. Alpine.js Integration

Alpine.js provides reactive behaviors directly in markup via `x-data`, `x-bind`, and `x-on`.

### Dynamic Link Generation (`x-for`):
When Alpine dynamically inserts new links via `x-for` or toggles visibility via `x-show`, Flash Page's internal `MutationObserver` catches the new elements immediately, binding pointer events without requiring manual re-initialization.

### Alpine Dropdown Example:
```html
<div x-data="{ open: false }">
    <button @click="open = !open">Options</button>

    <div x-show="open" @click.outside="open = false">
        <!-- New links immediately protected and preloaded on hover -->
        <a href="/profile">My Profile</a>
        <a href="/billing" data-flash-priority="high">Billing</a>
        <a href="/logout" data-no-flash>Log Out</a>
    </div>
</div>
```

---

## 3. Turbo / Hotwire Integration

Hotwire Turbo uses Turbo Drive to intercept link clicks and replace the `document.body` without reloading scripts.

### Lifecycle Synchronization:
Because Turbo Drive swaps the DOM on navigation, initialize Flash Page on the `turbo:load` event:

```javascript
import { init } from 'flash-page'

document.addEventListener('turbo:load', () => {
    init({
        intensity: 65,
        specrules: 'prerender',
        cartSafeguards: true
    })
})
```

### Turbo Method Safeguards:
Flash Page automatically recognizes and ignores links using Turbo mutation methods:
* `data-turbo-method="delete"`
* `data-turbo-method="post"`
* `data-turbo-confirm`

```html
<!-- Automatically ignored by Flash Page due to data-turbo-method -->
<a href="/posts/42" data-turbo-method="delete" data-turbo-confirm="Are you sure?">
    Delete Post
</a>
```

---

## 4. Best Practices for Hypermedia Architectures

1. **Selective Whitelisting**: If your HTMX application mixes document navigation with heavy Ajax partials, consider enabling Whitelist mode (`whitelist: true`) and selectively tagging full-page links with `data-flash`.
2. **Infinite Scroll Feeds**: For infinite feeds powered by HTMX (`hx-trigger="revealed"`), Flash Page automatically pre-resolves outgoing links without causing memory bloat.
3. **DevTools HUD**: Use the in-browser HUD (`Ctrl+Shift+F`) to verify that HTMX partials are correctly bypassed while full navigation links are pre-warmed.
