# Astro Integration Guide

Flash Page provides official support for **Astro (v3, v4, and v5)**, including automated lifecycle synchronization with **Astro View Transitions** and **ClientRouter**.

---

## 1. Installation

Install Flash Page via your package manager:

```bash
npm install flash-page
```

---

## 2. Using `setupAstroTransitions`

Astro's View Transitions swap the HTML document without a full browser reload. Flash Page exports `setupAstroTransitions`, which listens to `astro:page-load` events and automatically maintains active speculation rules and listeners across all page transitions.

### Basic Setup in Root Layout:
```astro
---
// src/layouts/BaseLayout.astro
import { ClientRouter } from 'astro:transitions' // Astro 5 (or <ViewTransitions /> in Astro 4)

interface Props {
    title: string
}

const { title } = Astro.props
---

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
    
    <!-- Astro View Transitions Router -->
    <ClientRouter />
</head>
<body>
    <slot />

    <!-- Initialize Flash Page with Astro Transitions -->
    <script>
        import { setupAstroTransitions } from 'flash-page'

        // Automatically binds to 'astro:page-load'
        setupAstroTransitions({
            intensity: 65,
            specrules: 'prerender',
            cartSafeguards: true,
            priorityQueue: true
        })
    </script>
</body>
</html>
```

---

## 3. Zero-Config Script Tag Setup (Static Astro Sites)

If your Astro site does not use client-side View Transitions (pure static multi-page generation), you can simply drop in the CDN script or import it directly:

```astro
---
// src/layouts/StaticLayout.astro
const { title } = Astro.props
---

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>{title}</title>
</head>
<body>
    <slot />

    <script>
        import { init } from 'flash-page'

        init({
            intensity: 65,
            specrules: 'prefetch'
        })
    </script>
</body>
</html>
```

---

## 4. Per-Component Preload Overrides in Astro

You can use standard Flash Page data attributes directly in `.astro` components:

```astro
---
// src/components/HeroNav.astro
---

<nav class="hero-nav">
    <!-- Prerender high-priority route instantly -->
    <a href="/pricing" data-flash-specrules="prerender" data-flash-priority="high">
        Get Started (Instant 0ms)
    </a>

    <!-- Standard prefetch on hover -->
    <a href="/blog">Our Blog</a>

    <!-- Opt-out dynamic endpoint -->
    <a href="/api/rss.xml" data-no-flash>RSS Feed</a>
</nav>
```

---

## 5. Best Practices in Astro

1. **Astro Islands (`client:*`)**: Flash Page operates on the document level, so links rendered inside React, Vue, or Svelte islands (e.g. `<Cart client:load />`) are automatically captured by Flash Page's `MutationObserver`.
2. **View Transitions Persistence**: Do not use `astro:after-swap` manually; `setupAstroTransitions()` already synchronizes state on `astro:page-load`.
3. **Data Saver Compatibility**: On mobile and constrained devices, Flash Page automatically pauses prefetching, keeping your Astro site ultra-fast and data-friendly.
