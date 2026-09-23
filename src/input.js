/*! Flash Page: Pointer Events & Predictive Trajectory */

import { getConfig, setCachedBattery } from './config.js'
import { isPreloadable, getAnchorHref } from './guards.js'

let _hoverTimer = null
let _currentHoverAnchor = null
let _lastPointerX = 0
let _lastPointerY = 0
let _lastPointerTime = 0
let _isRapidScrolling = false
let _scrollTimeout = null

export function isRapidScrolling() {
    return _isRapidScrolling
}

export function resetInputState() {
    if (_hoverTimer) {
        clearTimeout(_hoverTimer)
        _hoverTimer = null
    }
    if (_scrollTimeout) {
        clearTimeout(_scrollTimeout)
        _scrollTimeout = null
    }
    _currentHoverAnchor = null
    _isRapidScrolling = false
}

export function setupEventListeners(signal, onPreloadRequest, onToggleHUD) {
    const config = getConfig()
    const isMousedownOnly = config.intensity === 'mousedown-only'
    const isMousedown = config.intensity === 'mousedown'
    const isViewport = config.intensity === 'viewport' || config.intensity === 'viewport-all'

    // Monitor battery changes asynchronously if supported
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator && typeof navigator.getBattery === 'function') {
        navigator.getBattery().then(bat => {
            setCachedBattery(bat)
            bat.addEventListener('levelchange', () => { setCachedBattery(bat) }, { signal })
            bat.addEventListener('chargingchange', () => { setCachedBattery(bat) }, { signal })
        }).catch(() => {})
    }

    // 1. Keyboard Shortcut for DevTools HUD (Ctrl + Shift + F or Cmd + Shift + F)
    if (typeof onToggleHUD === 'function') {
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
                event.preventDefault()
                onToggleHUD()
            }
        }, { signal })
    }

    // 2. Pointer Down (Mobile touch tap & Desktop click start)
    document.addEventListener('pointerdown', (event) => {
        const anchor = event.target && event.target.closest ? event.target.closest('a') : null
        if (isPreloadable(anchor)) {
            const href = getAnchorHref(anchor)
            if (href) onPreloadRequest(href, 'high')
        }
    }, { capture: true, passive: true, signal })

    // 3. Pointer Over (Desktop mouse hover)
    if (!isMousedownOnly) {
        document.addEventListener('pointerover', (event) => {
            if (event.pointerType !== 'mouse') return

            const anchor = event.target && event.target.closest ? event.target.closest('a') : null
            if (!anchor || anchor === _currentHoverAnchor || !isPreloadable(anchor)) return

            _currentHoverAnchor = anchor

            const onLeave = (e) => {
                if (e.relatedTarget && anchor.contains(e.relatedTarget)) {
                    return
                }
                if (_hoverTimer) {
                    clearTimeout(_hoverTimer)
                    _hoverTimer = null
                }
                _currentHoverAnchor = null
                anchor.removeEventListener('pointerout', onLeave)
            }
            anchor.addEventListener('pointerout', onLeave, { passive: true })

            if (isMousedown) return

            let delay = config.delayOnHover
            if (anchor.dataset) {
                if (anchor.dataset.flashIntensity) {
                    const parsed = parseInt(anchor.dataset.flashIntensity, 10)
                    if (!isNaN(parsed)) delay = parsed
                } else if (anchor.dataset.instantIntensity) {
                    const parsed = parseInt(anchor.dataset.instantIntensity, 10)
                    if (!isNaN(parsed)) delay = parsed
                }
            }

            _hoverTimer = setTimeout(() => {
                const href = getAnchorHref(anchor)
                if (href) onPreloadRequest(href, 'high')
                _hoverTimer = null
            }, delay)
        }, { capture: true, passive: true, signal })
    }

    // 4. Predictive Cursor Trajectory with Intent Cone
    if (config.predictive || config.intensity === 'predictive') {
        document.addEventListener('pointermove', (e) => onPointerMoveTrajectory(e, onPreloadRequest), { passive: true, signal })
    }

    // 5. Scroll Acceleration Detection for Viewport Mode
    if (isViewport) {
        window.addEventListener('scroll', () => {
            _isRapidScrolling = true
            if (_scrollTimeout) clearTimeout(_scrollTimeout)
            _scrollTimeout = setTimeout(() => {
                _isRapidScrolling = false
            }, 150)
        }, { passive: true, signal })
    }
}

function onPointerMoveTrajectory(event, onPreloadRequest) {
    if (event.pointerType !== 'mouse') return

    const now = performance.now()
    const dt = now - _lastPointerTime
    if (dt < 25) return // Throttle trajectory calculation to ~40Hz

    const vx = (event.clientX - _lastPointerX) / dt
    const vy = (event.clientY - _lastPointerY) / dt
    _lastPointerX = event.clientX
    _lastPointerY = event.clientY
    _lastPointerTime = now

    const speedSq = vx * vx + vy * vy
    if (speedSq < 0.1 || speedSq > 15) return // Ignore stationary or violent flicks

    const config = getConfig()
    const projDist = 120
    const testPoints = [
        { x: Math.round(event.clientX + vx * projDist), y: Math.round(event.clientY + vy * projDist) }
    ]

    if (config.intentCone) {
        const len = Math.sqrt(speedSq)
        const nx = -vy / len
        const ny = vx / len
        const spread = 25
        testPoints.push(
            { x: Math.round(event.clientX + vx * projDist + nx * spread), y: Math.round(event.clientY + vy * projDist + ny * spread) },
            { x: Math.round(event.clientX + vx * projDist - nx * spread), y: Math.round(event.clientY + vy * projDist - ny * spread) }
        )
    }

    for (const pt of testPoints) {
        if (pt.x < 0 || pt.x > window.innerWidth || pt.y < 0 || pt.y > window.innerHeight) continue
        const element = document.elementFromPoint(pt.x, pt.y)
        const anchor = element && element.closest ? element.closest('a') : null
        if (isPreloadable(anchor)) {
            const href = getAnchorHref(anchor)
            if (href) onPreloadRequest(href, 'low')
            break
        }
    }
}

