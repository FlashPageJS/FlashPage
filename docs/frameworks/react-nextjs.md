# React & Next.js Integration Guide

Flash Page provides official first-class adapters for **React 18/19** and **Next.js (App Router & Pages Router)**.

---

## 1. Installation

Install the package via your package manager:

```bash
npm install flash-page
```

---

## 2. Using the `useFlashPage` Hook

The `useFlashPage` hook initializes Flash Page on component mount and provides reactive getters for preloading, runtime status, and navigation metrics.

### Signature:
```typescript
function useFlashPage(config?: Partial<FlashPageConfig>): {
    preload: (url: string, priority?: 'high' | 'auto' | 'low') => void
    destroy: () => void
    status: FlashPageStatus
    getStatus: () => FlashPageStatus
    getMetrics: () => FlashPageMetric[]
    toggleHUD: (forceOpen?: boolean) => void
    isPreloadable: (anchor: HTMLAnchorElement | HTMLElement) => boolean
    isUrlPreloadable: (url: string) => boolean
    predictNextLink: (fromPath: string) => string | null
    preconnectOrigins: (origins: string[]) => void
    isServerHealthy: () => boolean
    isEnvironmentEligible: () => boolean
    setBackpressure: (retryAfterSeconds?: number) => void
    config: FlashPageConfig
}
```

### Component Example:
```tsx
// src/components/Navigation.tsx
'use client'

import React from 'react'
import { useFlashPage } from 'flash-page'

export function Navigation() {
    // Initialize Flash Page with custom settings
    const { preload, status } = useFlashPage({
        intensity: 65,
        specrules: 'prerender',
        cartSafeguards: true
    })

    return (
        <nav style={{ display: 'flex', gap: '20px' }}>
            <a href="/dashboard">Dashboard</a>
            <a href="/analytics">Analytics</a>
            
            {/* Programmatic prefetch on button hover */}
            <button 
                onPointerEnter={() => preload('/reports', 'high')}
                onClick={() => window.location.href = '/reports'}
            >
                Quick Reports
            </button>

            {/* Display engine status */}
            <span style={{ fontSize: '12px', color: '#666' }}>
                Engine: {status.engine} (Preloaded: {status.preloadedCount})
            </span>
        </nav>
    )
}
```

---

## 3. Using the `<FlashLink>` Component

Flash Page exports `createFlashLink(React)` to generate high-performance anchor components compatible with React, Preact, and Next.js.

### Factory Setup:
```tsx
// src/components/FlashLink.tsx
import React from 'react'
import { createFlashLink } from 'flash-page'

// Create a typed FlashLink component
export const FlashLink = createFlashLink(React)
```

### Usage Example:
```tsx
import { FlashLink } from './FlashLink'

export function ProductCard({ product }) {
    return (
        <div className="product-card">
            <h3>{product.title}</h3>
            <p>${product.price}</p>
            
            {/* Standard prefetch */}
            <FlashLink href={`/products/${product.slug}`}>
                View Details
            </FlashLink>

            {/* Instant 0ms Prerender with High Priority */}
            <FlashLink 
                href={`/products/${product.slug}/reviews`}
                priority="high"
                asPrerender={true}
            >
                Read Reviews (Instant)
            </FlashLink>

            {/* Explicitly exclude a sensitive link */}
            <FlashLink href="/cart/remove-all" noFlash={true}>
                Clear Cart (Protected)
            </FlashLink>
        </div>
    )
}
```

---

## 4. Next.js 14/15 App Router Integration

In the Next.js App Router (`app/` directory), server components cannot run DOM event listeners directly. Create a small client provider to initialize Flash Page globally.

### Step 1: Create the Client Provider
```tsx
// app/providers/FlashPageProvider.tsx
'use client'

import { useEffect } from 'react'
import { init, destroy } from 'flash-page'

export function FlashPageProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        init({
            intensity: 65,
            specrules: 'prerender',
            cartSafeguards: true,
            priorityQueue: true
        })

        return () => {
            destroy()
        }
    }, [])

    return <>{children}</>
}
```

### Step 2: Wrap Root Layout
```tsx
// app/layout.tsx
import { FlashPageProvider } from './providers/FlashPageProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <FlashPageProvider>
                    {children}
                </FlashPageProvider>
            </body>
        </html>
    )
}
```

### Coexistence with Next.js `<Link>`:
Flash Page works seamlessly alongside Next.js `<Link>`. Next.js pre-fetches React Server Component (RSC) payload JSON, while Flash Page pre-fetches or prerenders the full document cache for instantaneous transitions.

---

## 5. Next.js Pages Router Integration

For projects using the Pages Router (`pages/` directory), initialize Flash Page inside `pages/_app.tsx`:

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { init, destroy } from 'flash-page'

export default function MyApp({ Component, pageProps }: AppProps) {
    useEffect(() => {
        init({
            intensity: 65,
            specrules: 'prefetch',
            cartSafeguards: true
        })

        return () => {
            destroy()
        }
    }, [])

    return <Component {...pageProps} />
}
```

---

## 6. Best Practices in React Applications

1. **Client Boundary (`'use client'`)**: Always invoke `useFlashPage` or `init` in client components. Flash Page requires browser APIs (`window`, `document`, `sessionStorage`).
2. **Dynamic Route Safety**: Flash Page automatically handles dynamic route changes via its internal `MutationObserver`. You do not need to re-initialize on route navigation.
3. **Cart & Sensitive Forms**: For links that mutate state, attach `data-no-flash` to guarantee they are never speculated:
   ```tsx
   <a href="/api/auth/signout" data-no-flash>Sign Out</a>
   ```
