/*
 * NouTube Native — minimal injected content script (MVP).
 *
 * The WebView is only a BROWSE + DOWNLOAD surface here — playback happens in the
 * native ExoPlayer, not in the page. So this script does exactly one thing:
 * add a floating "download" button on watch pages that reports the current
 * video URL to Kotlin (window.NouTubeI.onMessage). Everything else (the native
 * player, background, notification) lives in Kotlin.
 *
 * Kept small and defensive: YouTube-internal access is wrapped so a change
 * degrades instead of throwing. Injected on every page start.
 */
(function () {
  'use strict'
  if (window.__nouInstalled) return
  window.__nouInstalled = true

  var I = window.NouTubeI // Kotlin bridge (@JavascriptInterface)
  if (!I) return

  var BTN_ID = '_nou_download_btn'

  function safe(fn) {
    try { return fn() } catch (e) { return undefined }
  }

  function currentVideoUrl() {
    var el = document.getElementById('movie_player')
    var fromPlayer = el && safe(function () { return el.getVideoUrl() })
    return fromPlayer || location.href
  }

  function isWatch() {
    return location.pathname === '/watch' || location.hostname === 'music.youtube.com'
  }

  function ensureButton() {
    if (!isWatch()) {
      var stale = document.getElementById(BTN_ID)
      if (stale) stale.remove()
      return
    }
    if (document.getElementById(BTN_ID)) return

    var btn = document.createElement('button')
    btn.id = BTN_ID
    btn.type = 'button'
    btn.setAttribute('aria-label', 'Download')
    btn.textContent = '⬇'
    btn.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:96px', 'z-index:2147483647',
      'width:48px', 'height:48px', 'border-radius:24px', 'border:none',
      'background:#0f0f0f', 'color:#fff', 'font-size:22px', 'line-height:48px',
      'box-shadow:0 2px 8px rgba(0,0,0,.4)', 'cursor:pointer', 'padding:0',
    ].join(';')
    btn.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      try {
        I.onMessage(JSON.stringify({ type: 'download', data: { url: currentVideoUrl() } }))
      } catch (err) {}
    })
    document.body.appendChild(btn)
  }

  ensureButton()
  // YouTube is a SPA; re-check on soft navigations.
  window.addEventListener('yt-navigate-finish', ensureButton)
  setInterval(ensureButton, 3000)
})()
