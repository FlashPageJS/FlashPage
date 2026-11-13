# Svelte 5 & SvelteKit Integration Guide

Flash Page provides first-class support for **Svelte 4/5** and **SvelteKit**, including a custom element action (`flashAction`) and layout lifecycle management.

---

## 1. Installation

Install Flash Page via your package manager:

```bash
npm install flash-page
```

---

## 2. Using the `flashAction` Action

Flash Page exports `flashAction`, an idiomatic Svelte action that attaches touch and pointer prefetch listeners directly to DOM elements.

### Basic Usage:
```svelte
<!-- src/lib/NavMenu.svelte -->
<script>
    import { flashAction } from 'flash-page'
</script>

<nav>
    <!-- Standard automatic speculation on hover -->
    <a href="/about" use:flashAction>About Us</a>

    <!-- High priority prefetch in queue -->
    <a href="/pricing" use:flashAction={{ priority: 'high' }}>Pricing</a>

    <!-- Instant 0ms Native Prerender -->
    <a href="/features" use:flashAction={{ prerender: true }}>Features (Instant)</a>

    <!-- Explicitly exclude a sensitive link -->
    <a href="/logout" use:flashAction={{ noFlash: true }}>Log Out (Protected)</a>

    <!-- Programmatic explicit URL override -->
    <button use:flashAction={{ href: '/quick-start', priority: 'high' }}>
        Quick Start
    </button>
</nav>
```

### Action Options:
* `priority` (`'high' | 'auto' | 'low'`, default: `'auto'`): Sets priority level in the queue.
* `prerender` (`boolean`, default: `false`): Attaches `data-flash-specrules="prerender"` for instant 0ms native prerendering.
* `noFlash` (`boolean`, default: `false`): Attaches `data-no-flash` and permanently blocks speculative execution.
* `href` (`string`, optional): Explicit target URL if the element is not an `<a>` tag with an `href` attribute.

---

## 3. SvelteKit Root Layout Integration

In SvelteKit, initialize Flash Page inside your root layout (`src/routes/+layout.svelte`) so it runs across all page navigations.

### `src/routes/+layout.svelte`:
```svelte
<script>
    import { onMount, onDestroy } from 'svelte'
    import { browser } from '$app/environment'
    import { init, destroy } from 'flash-page'

    onMount(() => {
        if (browser) {
            init({
                intensity: 65,
                specrules: 'prerender',
                cartSafeguards: true,
                priorityQueue: true
            })
        }
    })

    onDestroy(() => {
        if (browser) {
            destroy()
        }
    })
</script>

<!-- Render current route content -->
<slot />
```

### Svelte 5 (Runes Syntax):
If you are using Svelte 5 with runes:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
    import { onMount } from 'svelte'
    import { browser } from '$app/environment'
    import { init, destroy } from 'flash-page'

    let { children } = $props()

    $effect(() => {
        if (browser) {
            init({
                intensity: 65,
                specrules: 'prerender',
                cartSafeguards: true
            })

            return () => {
                destroy()
            }
        }
    })
</script>

{@render children()}
```

---

## 4. Coexistence with SvelteKit Preloading

SvelteKit provides native data preloading via `data-sveltekit-preload-data="hover"`. Flash Page operates in perfect synergy with SvelteKit:

1. **SvelteKit `preload-data`**: Fetches the server data load function (`+page.server.ts`) in the background.
2. **Flash Page**: Prefetches or prerenders the entire HTML document and establishes DNS/TLS sockets via Speculation Rules.

Together, SvelteKit data hydrations and Flash Page document deliveries produce completely seamless, instant navigations.

---

## 5. Best Practices in SvelteKit

1. **Browser Guard (`$app/environment`)**: Always wrap client calls with `if (browser)` or place them in `onMount()` to prevent execution during SSR.
2. **SvelteKit Form Actions**: For forms using `use:enhance` or links that trigger non-GET actions, add `data-no-flash`:
   ```svelte
   <a href="/auth/logout" data-no-flash>Log Out</a>
   ```
3. **Dynamic SPA Navigation**: Flash Page's internal `MutationObserver` automatically detects elements injected by Svelte's `{#if}` or `{#each}` blocks without needing manual rebinding.
