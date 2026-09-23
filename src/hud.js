/*! Flash Page: In-Browser DevTools HUD Overlay */

import { isServerHealthy } from './config.js'
import { getEngine } from './engines.js'
import { getQueueStatus } from './queue.js'

let _hudElement = null
let _hudStyleElement = null

export function resetHUD() {
    if (_hudElement && _hudElement.parentNode) {
        _hudElement.parentNode.removeChild(_hudElement)
    }
    if (_hudStyleElement && _hudStyleElement.parentNode) {
        _hudStyleElement.parentNode.removeChild(_hudStyleElement)
    }
    _hudElement = null
    _hudStyleElement = null
}

export function toggleHUD(forceOpen) {
    if (typeof document === 'undefined') return

    if (_hudElement && (forceOpen === false || (forceOpen === undefined && _hudElement.style.display !== 'none'))) {
        _hudElement.style.display = 'none'
        return
    }

    if (!_hudElement) {
        createHUD()
    }

    _hudElement.style.display = 'block'
    updateHUD()
}

function createHUD() {
    _hudElement = document.createElement('div')
    _hudElement.id = 'flash-hud'
    _hudElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999999;
    background: rgba(16, 20, 24, 0.95);
    backdrop-filter: blur(8px);
    color: #e2e8f0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    min-width: 230px;
    user-select: none;
  `

    _hudStyleElement = document.createElement('style')
    _hudStyleElement.textContent = `
    a[data-flash-highlighted="true"] {
      outline: 2px solid #00f0ff !important;
      box-shadow: 0 0 8px rgba(0, 240, 255, 0.4) !important;
      transition: outline 0.15s ease !important;
    }
  `
    const target = document.head || document.documentElement
    if (target) target.appendChild(_hudStyleElement)
    if (document.body) document.body.appendChild(_hudElement)
}

export function updateHUD() {
    if (!_hudElement || _hudElement.style.display === 'none') return

    const queue = getQueueStatus()
    const engine = getEngine()
    const isHealthy = isServerHealthy()

    const healthBadge = isHealthy
        ? '<span style="color:#10b981">● Normal</span>'
        : '<span style="color:#ef4444">● Backpressure</span>'

    _hudElement.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px">
      <span style="font-weight:bold;color:#38bdf8">⚡ Flash Page v1.0.0</span>
      <span id="flash-hud-close" style="cursor:pointer;color:#94a3b8;font-size:13px;padding:2px 4px">✕</span>
    </div>
    <div>Engine: <span style="color:#f1f5f9">${engine}</span></div>
    <div>Preloaded: <span style="color:#38bdf8;font-weight:bold">${queue.preloadedCount}</span></div>
    <div>Active / Queue: <span style="color:${queue.inflightCount > 0 ? '#38bdf8;font-weight:bold' : '#f1f5f9'}">${queue.inflightCount}</span> / <span style="color:${queue.queueLength > 0 ? '#f59e0b;font-weight:bold' : '#f1f5f9'}">${queue.queueLength}</span></div>
    <div>Server Health: ${healthBadge}</div>
    <div style="margin-top:6px;font-size:9px;color:#64748b">Press Ctrl+Shift+F to toggle</div>
  `

    const closeBtn = _hudElement.querySelector('#flash-hud-close')
    if (closeBtn) {
        closeBtn.onclick = () => toggleHUD(false)
    }
}

export function highlightPreloadedAnchor(url) {
    if (typeof document === 'undefined') return
    try {
        const loc = typeof location !== 'undefined' ? location : null
        const urlObj = new URL(url, loc ? loc.href : undefined)
        const anchors = document.querySelectorAll('a')
        anchors.forEach(a => {
            const aHref = a.href || a.getAttribute('href')
            if (!aHref) return
            try {
                const aUrl = new URL(aHref, loc ? loc.href : undefined)
                if (aUrl.href === urlObj.href || aUrl.pathname === urlObj.pathname) {
                    a.setAttribute('data-flash-highlighted', 'true')
                }
            } catch {}
        })
    } catch {}
}

