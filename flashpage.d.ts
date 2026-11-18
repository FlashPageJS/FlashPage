/*! Flash Page v1.2.1 - TypeScript Definitions | GPL-3.0-or-later */

export interface FlashPageConfig {
    /**
     * Preload intensity:
     * - number (ms): hover delay threshold before preloading (default: 65)
     * - 'mousedown': preloads on mousedown (desktop) and touch tap
     * - 'mousedown-only': disables hover, preloads only on mousedown/tap
     * - 'viewport': preloads visible links in viewport for small screens
     * - 'viewport-all': preloads visible links across all screen sizes
     * - 'predictive': enables cursor trajectory projection to preload before hover
     */
    intensity?: 'mousedown' | 'mousedown-only' | 'viewport' | 'viewport-all' | 'predictive' | 'intent-cone' | number;

    /** Hover delay in milliseconds (default: 65) */
    delayOnHover?: number;

    /** Whether to allow preloading links with query parameters (default: false) */
    allowQueryString?: boolean;

    /** Whether to allow preloading external origin links (default: false) */
    allowExternalLinks?: boolean;

    /** If true, only links with data-flash attributes are preloaded (default: false) */
    whitelist?: boolean;

    /** Speculation rules mode: 'prefetch' | 'prerender' | 'no' (default: 'prefetch') */
    specrules?: 'prerender' | 'prefetch' | 'no';

    /** Whether to enable mouse trajectory velocity prediction (default: false) */
    predictive?: boolean;

    /** Whether to automatically suspend preloading if Save-Data or 2G is detected (default: true) */
    respectDataSaver?: boolean;

    /** Whether to automatically suspend preloading if device battery is below 20% (default: true) */
    respectBattery?: boolean;

    /** Whether to use low-priority fetch cache warming on Safari/WebKit (default: true) */
    safariFallback?: boolean;

    /** Maximum concurrent in-flight prefetch requests (default: 3) */
    maxConcurrent?: number;

    /** Enable verbose console debugging (default: false) */
    debug?: boolean;

    /** Enable in-browser DevTools HUD overlay (default: false, toggle with Ctrl+Shift+F) */
    hud?: boolean;

    /** Whether to pre-warm linked critical CSS stylesheets and fonts (default: false) */
    subresources?: boolean;

    /** Whether to enable client-side Markov chain predictive navigation (default: true) */
    markov?: boolean;

    /** Whether to automatically pause speculation on server 429 / 503 backpressure (default: true) */
    backpressure?: boolean;

    /** Whether to expand cursor trajectory into a 3-point intent cone (default: true) */
    intentCone?: boolean;

    /** Content Security Policy (CSP) nonce attached to generated Speculation Rules script tags */
    nonce?: string;

    /** Whether to dynamically scale concurrency between 1 and 6 based on network downlink and RTT (default: false) */
    adaptiveConcurrency?: boolean;

    /** HTTP(S) endpoint URL to stream navigation metrics via navigator.sendBeacon */
    beaconUrl?: string | null;

    /** Native telemetry exporter: 'ga4' | 'datadog' | 'sentry' or custom callback function */
    analytics?: 'ga4' | 'datadog' | 'sentry' | ((metric: FlashPageMetric) => void) | null;

    /** Automatically pause Hotjar, Clarity, and FullStory during speculation to prevent false-positive tracking (default: true) */
    isolateHeatmaps?: boolean;

    /** Automatically block prefetching e-commerce cart, checkout, and basket mutation routes (default: true) */
    cartSafeguards?: boolean;

    /** Prioritize user interactions (hover, intent cone) over background viewport preloads (default: true) */
    priorityQueue?: boolean;

    /** Injects preconnect and dns-prefetch tags for external CDN assets discovered in prefetched HTML (default: true) */
    preconnectCdn?: boolean;

    /** Custom filter predicate to allow or deny preloading a specific anchor */
    filter?: (url: URL, element: HTMLAnchorElement) => boolean;

    /** Callback fired whenever a URL is preloaded */
    onPreload?: (url: string, engine: string) => void;

    /** Callback fired with navigation conversion metrics */
    onMetric?: (metric: FlashPageMetric) => void;
}

export interface FlashPageMetric {
    url: string;
    converted: boolean;
    transferSize: number;
    duration: number;
    timestamp: number;
    wasPrerendered?: boolean;
    activationStart?: number;
    lcpSavedMs?: number;
}

export interface FlashPageStatus {
    initialized: boolean;
    engine: 'document-rules' | 'speculation-list' | 'link' | 'fetch' | 'none';
    preloadedCount: number;
    inflightCount: number;
    queueLength: number;
    effectiveConcurrency?: number;
    isHealthy: boolean;
    backpressureUntil: number;
    config: FlashPageConfig;
}

/**
 * Initializes Flash Page with optional configuration
 */
export function init(customConfig?: Partial<FlashPageConfig>): void;

/**
 * Programmatically triggers preloading of a URL
 */
export function preload(url: string, priority?: 'auto' | 'high' | 'low'): void;

/**
 * Cleanly destroys Flash Page and removes all event listeners and observers
 */
export function destroy(): void;

/**
 * Returns recorded navigation metrics
 */
export function getMetrics(): FlashPageMetric[];

/**
 * Returns current engine and queue status
 */
export function status(): FlashPageStatus;

/**
 * Toggles the in-browser DevTools HUD overlay
 */
export function toggleHUD(forceOpen?: boolean): void;

/**
 * Checks whether an anchor element is eligible for preloading
 */
export function isPreloadable(anchor: HTMLAnchorElement | null): boolean;

/**
 * Checks whether a raw URL string is safe and eligible for preloading
 */
export function isUrlPreloadable(url: string, config?: Partial<FlashPageConfig>, anchor?: any): boolean;

/**
 * Safely extracts the href string from HTMLAnchorElement, SVGAElement, or generic element
 */
export function getAnchorHref(anchor: any): string | null;

/**
 * Checks whether the server is healthy or in a backoff window
 */
export function isServerHealthy(): boolean;

/**
 * Checks whether the current device and network environment are eligible for preloading
 */
export function isEnvironmentEligible(): boolean;

/**
 * Manually sets a backpressure timeout window in seconds
 */
export function setBackpressure(retryAfterSeconds?: number): void;

/**
 * Returns the epoch timestamp until which preloading is suspended due to backpressure
 */
export function getBackpressureUntil(): number;

/**
 * Sets mock battery status for testing or custom battery observers
 */
export function setCachedBattery(bat: { level: number; charging: boolean } | null): void;

/**
 * Returns current configuration object
 */
export function getConfig(): FlashPageConfig;

/**
 * Updates configuration options
 */
export function setConfig(newConfig: Partial<FlashPageConfig>): void;

/**
 * Resets configuration to default values
 */
export function resetConfig(): void;

/**
 * Extracts critical subresource links from an HTML document string
 */
export function extractSubresources(htmlText: string): string[];

/**
 * Extracts unique external CDN origins from subresource links
 */
export function extractExternalOrigins(htmlText: string): string[];

/**
 * Injects preconnect and dns-prefetch links for external origins into document head
 */
export function preconnectOrigins(origins: string[]): void;

/**
 * Records a navigation transition in the client-side Markov model
 */
export function recordTransition(fromPath: string, toPath: string): void;

/**
 * Predicts the most probable next link destination from the Markov model
 */
export function predictNextLink(fromPath: string): string | null;

export interface FlashPageHookReturn {
    preload: typeof preload;
    destroy: typeof destroy;
    status: FlashPageStatus;
    getStatus: typeof status;
    getMetrics: typeof getMetrics;
    toggleHUD: typeof toggleHUD;
    isPreloadable: typeof isPreloadable;
    isUrlPreloadable: typeof isUrlPreloadable;
    predictNextLink: typeof predictNextLink;
    preconnectOrigins: typeof preconnectOrigins;
    isServerHealthy: typeof isServerHealthy;
    isEnvironmentEligible: typeof isEnvironmentEligible;
    setBackpressure: typeof setBackpressure;
    config: FlashPageConfig;
}

/**
 * React hook for Flash Page integration with full library access
 */
export function useFlashPage(config?: Partial<FlashPageConfig>): FlashPageHookReturn;

/**
 * Vue 3 & Nuxt 3 composable with full library access
 */
export function useFlash(config?: Partial<FlashPageConfig>): FlashPageHookReturn;

/**
 * Vue 3 directive for Flash Page
 */
export const vFlash: {
    mounted(el: HTMLElement, binding?: { value?: string; arg?: string; modifiers?: Record<string, boolean> }): void;
    updated(el: HTMLElement, binding?: { value?: string; arg?: string; modifiers?: Record<string, boolean> }): void;
};

/**
 * Svelte 5 action for use:flashAction
 */
export function flashAction(node: HTMLElement, options?: { href?: string; priority?: 'auto' | 'high' | 'low'; prerender?: boolean; noFlash?: boolean; exclude?: boolean }): {
    update?(newOptions?: { href?: string; priority?: 'auto' | 'high' | 'low'; prerender?: boolean; noFlash?: boolean; exclude?: boolean }): void;
    destroy?(): void;
};

/**
 * Astro View Transitions Adapter
 */
export function setupAstroTransitions(config?: Partial<FlashPageConfig>): () => void;

/**
 * Factory to create React FlashLink component
 */
export function createFlashLink(React: any): any;

/**
 * React FlashLink Component
 */
export const FlashLink: any;

declare global {
    interface Window {
        flashPage: {
            init: typeof init;
            preload: typeof preload;
            destroy: typeof destroy;
            getMetrics: typeof getMetrics;
            status: typeof status;
            toggleHUD: typeof toggleHUD;
            recordTransition: typeof recordTransition;
            predictNextLink: typeof predictNextLink;
            isPreloadable: typeof isPreloadable;
            isUrlPreloadable: typeof isUrlPreloadable;
            isServerHealthy: typeof isServerHealthy;
            config: FlashPageConfig;
        };
    }

    interface WindowEventMap {
        'flash:ready': CustomEvent<{ status: FlashPageStatus }>;
        'flash:preload': CustomEvent<{ url: string; engine: string }>;
        'flash:metric': CustomEvent<FlashPageMetric>;
    }
}
