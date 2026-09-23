/*! Flash Page v1.0.0 - TypeScript Definitions | GPL-3.0-or-later */

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
}

export interface FlashPageStatus {
    initialized: boolean;
    engine: 'document-rules' | 'speculation-list' | 'link' | 'fetch' | 'none';
    preloadedCount: number;
    inflightCount: number;
    queueLength: number;
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
 * Records a navigation transition in the client-side Markov model
 */
export function recordTransition(fromPath: string, toPath: string): void;

/**
 * Predicts the most probable next link destination from the Markov model
 */
export function predictNextLink(fromPath: string): string | null;

/**
 * React hook for Flash Page integration
 */
export function useFlashPage(config?: Partial<FlashPageConfig>): {
    preload: typeof preload;
    status: FlashPageStatus;
    getMetrics: FlashPageMetric[];
};

/**
 * Vue 3 directive for Flash Page
 */
export const vFlash: {
    mounted(el: HTMLAnchorElement, binding?: { value?: string }): void;
};

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
            config: FlashPageConfig;
        };
    }

    interface WindowEventMap {
        'flash:ready': CustomEvent<{ status: FlashPageStatus }>;
        'flash:preload': CustomEvent<{ url: string; engine: string }>;
        'flash:metric': CustomEvent<FlashPageMetric>;
    }
}
