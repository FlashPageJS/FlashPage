# Vue 3 & Nuxt 3 Integration Guide

Flash Page provides dedicated adapters for **Vue 3** and **Nuxt 3**, including a custom directive (`v-flash`) and a Composition API composable (`useFlash`).

---

## 1. Installation

Install Flash Page via your package manager:

```bash
npm install flash-page
```

---

## 2. Using the `v-flash` Directive in Vue 3

Flash Page exports `vFlash`, a custom directive for Vue 3 templates that automatically configures preloading, speculative prerendering, and queue priorities.

### Global Registration in Vue 3:
```typescript
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { vFlash, init } from 'flash-page'

const app = createApp(App)

// Initialize global Flash Page runtime
init({
    intensity: 65,
    specrules: 'prerender',
    cartSafeguards: true
})

// Register the v-flash directive globally
app.directive('flash', vFlash)

app.mount('#app')
```

### Template Usage & Modifiers:

```vue
<!-- components/NavBar.vue -->
<template>
  <nav class="navigation">
    <!-- Standard speculative prefetch on hover -->
    <a href="/dashboard" v-flash>Dashboard</a>

    <!-- High priority prefetch in queue -->
    <a href="/pricing" v-flash:high>Pricing (High Priority)</a>

    <!-- Instant 0ms Native Prerendering (via argument or modifier) -->
    <a href="/features" v-flash:prerender>Features (Prerendered via argument)</a>
    <a href="/docs" v-flash.prerender>Docs (Prerendered via modifier)</a>

    <!-- Explicitly exclude a sensitive link -->
    <a href="/logout" v-flash.noFlash>Log Out (Protected)</a>

    <!-- Programmatic dynamic URL prefetch -->
    <button v-flash="dynamicTargetUrl">
      Quick Load Destination
    </button>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const dynamicTargetUrl = ref('/account/settings')
</script>
```

---

## 3. Using the `useFlash` Composable

For script-driven interactions, use the `useFlash` composable in your `<script setup>` block. It exposes all Flash Page methods, status getters, and metrics:

```vue
<!-- components/UserMenu.vue -->
<template>
  <div class="user-menu">
    <button @mouseenter="handleHover">Account Overview</button>
    
    <div v-if="status.initialized" class="status-indicator">
      Active Engine: {{ status.engine }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFlash } from 'flash-page'

const { 
    preload, 
    destroy,
    status, 
    getStatus, 
    getMetrics, 
    toggleHUD,
    predictNextLink,
    isServerHealthy 
} = useFlash({
    intensity: 65,
    specrules: 'prerender'
})

function handleHover() {
    if (isServerHealthy()) {
        preload('/account/overview', 'high')
    }
}
</script>
```

---

## 4. Nuxt 3 Integration (Client Plugin)

In Nuxt 3, create a client-side plugin to initialize Flash Page and register the directive across all pages.

### Create the Nuxt Plugin:
```typescript
// plugins/flashpage.client.ts
import { defineNuxtPlugin } from '#app'
import { init, destroy, vFlash } from 'flash-page'

export default defineNuxtPlugin((nuxtApp) => {
    // 1. Initialize Flash Page on client load
    init({
        intensity: 65,
        specrules: 'prerender',
        cartSafeguards: true,
        priorityQueue: true
    })

    // 2. Register directive
    nuxtApp.vueApp.directive('flash', vFlash)

    // 3. Optional: Sync with Nuxt page transitions
    nuxtApp.hook('page:finish', () => {
        // Flash Page MutationObserver catches new links automatically,
        // but hook ensures seamless sync after complex route transitions.
    })

    // 4. Teardown on app unmount
    nuxtApp.hook('app:beforeMount', () => {
        window.addEventListener('beforeunload', () => destroy(), { once: true })
    })
})
```

### Coexistence with `<NuxtLink>`:
Flash Page works seamlessly with `<NuxtLink>`. Simply apply the directive or let Flash Page's global observer inspect links automatically:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <h1>Welcome to Nuxt 3</h1>
    <NuxtLink to="/about" v-flash:prerender>
      About Page (Instant Prerender)
    </NuxtLink>
  </div>
</template>
```

---

## 5. Vue Router Best Practices

1. **Client-Side Only**: Ensure Flash Page functions run strictly in the browser environment (`process.client` in Nuxt or `onMounted()` in Vue).
2. **Hash and Internal Anchors**: Flash Page automatically ignores `#hash` links and external javascript URLs (`javascript:`), preventing false triggers during tab or accordion toggles.
3. **Cart & Payment Exclusions**: If using Pinia or Vuex for e-commerce, ensure shopping bag routes retain default safeguards:
   ```html
   <NuxtLink to="/checkout" data-no-flash>Checkout</NuxtLink>
   ```
