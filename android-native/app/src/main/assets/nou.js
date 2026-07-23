/*
 * NouTube Native — minimal injected content script (MVP).
 *
 * Responsibilities:
 *   1. Expose window.NouTube with play/pause/next/prev/seekBy that DELEGATE to
 *      YouTube's own web player (#movie_player). We never build a player.
 *   2. Watch the player, and push state to Kotlin via window.NouTubeI:
 *        - notify(title, author, seconds, thumbnail)  on video change
 *        - notifyProgress(playing, positionSeconds)   ~1x/second
 *   3. Add a floating "download" button on /watch pages that reports the
 *      current video URL to Kotlin (emit 'download'). A robust replacement for
 *      cloning YouTube's per-video "⋮" menu — that DOM surgery can be ported
 *      from the RN app's content/menu.ts later.
 *
 * This is intentionally small and defensive: every YouTube-internal access is
 * wrapped so a YouTube change degrades instead of throwing. Injected on every
 * page start via WebView.evaluateJavascript from ScriptInjector.kt.
 */
(function () {
  'use strict'
  if (window.__nouInstalled) return
  window.__nouInstalled = true

  var I = window.NouTubeI // Kotlin bridge (@JavascriptInterface). May be undefined on desktop web.

  function getPlayer() {
    return document.getElementById('movie_player')
  }

  function safe(fn) {
    try {
      return fn()
    } catch (e) {
      /* swallow: YouTube internals changed */
      return undefined
    }
  }

  function emit(type, data) {
    if (I && I.onMessage) {
      try {
        I.onMessage(JSON.stringify({ type: type, data: data }))
      } catch (e) {}
    }
  }

  // ---- window.NouTube: remote control surface driven from Kotlin ------------
  window.NouTube = {
    play: function () { return safe(function () { return getPlayer().playVideo() }) },
    pause: function () { return safe(function () { return getPlayer().pauseVideo() }) },
    next: function () { return safe(function () { return getPlayer().nextVideo() }) },
    prev: function () { return safe(function () { return getPlayer().previousVideo() }) },
    seekBy: function (delta) { return safe(function () { return getPlayer().seekBy(delta) }) },
    seekTo: function (sec) { return safe(function () { return getPlayer().seekTo(sec, true) }) },
    getVideoUrl: function () { return safe(function () { return getPlayer().getVideoUrl() }) || '' },
  }

  // ---- throttling helper ----------------------------------------------------
  function throttle(fn, ms) {
    var last = 0
    var timer = null
    return function () {
      var now = Date.now()
      var remaining = ms - (now - last)
      var args = arguments
      var ctx = this
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null }
        last = now
        fn.apply(ctx, args)
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now()
          timer = null
          fn.apply(ctx, args)
        }, remaining)
      }
    }
  }

  // ---- player state bridge --------------------------------------------------
  var currentVideoId = ''

  function hookPlayer(el) {
    if (!el || el.__nouHooked) return
    el.__nouHooked = true

    var pushProgress = throttle(function () {
      var playing = safe(function () { return el.getPlayerState() === 1 })
      var pos = safe(function () { return el.getCurrentTime() }) || 0
      if (I && I.notifyProgress) {
        try { I.notifyProgress(!!playing, Math.floor(pos)) } catch (e) {}
      }
    }, 1000)

    safe(function () {
      el.addEventListener('onStateChange', function () {
        var resp = safe(function () { return el.getPlayerResponse() }) || {}
        var details = resp.videoDetails
        if (!details) return

        if (details.videoId !== currentVideoId) {
          currentVideoId = details.videoId
          var thumbs = (details.thumbnail && details.thumbnail.thumbnails) || []
          var thumb = thumbs.length ? thumbs[thumbs.length - 1].url : ''
          var duration = parseInt(details.lengthSeconds, 10) || 0
          if (I && I.notify) {
            try {
              I.notify(details.title || '', details.author || '', duration, thumb || '')
            } catch (e) {}
          }
          ensureDownloadButton()
        }
        pushProgress()
      })
    })

    // Also drive progress from the underlying <video> element for smoother 1s ticks.
    var video = document.querySelector('#movie_player video') || document.querySelector('video')
    if (video && !video.__nouProgressHooked) {
      video.__nouProgressHooked = true
      ;['play', 'pause', 'timeupdate'].forEach(function (evt) {
        video.addEventListener(evt, pushProgress)
      })
    }
  }

  // ---- floating download button (watch pages only) -------------------------
  var BTN_ID = '_nou_download_btn'

  function isWatch() {
    return location.pathname === '/watch' || location.hostname === 'music.youtube.com'
  }

  function ensureDownloadButton() {
    if (!I) return // only in the native app
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
      var url = window.NouTube.getVideoUrl() || location.href
      emit('download', { url: url })
    })
    document.body.appendChild(btn)
  }

  // ---- boot: find the player now or when it shows up ------------------------
  function scan() {
    var el = getPlayer()
    if (el) hookPlayer(el)
    ensureDownloadButton()
  }

  scan()
  var obs = new MutationObserver(function () { scan() })
  if (document.documentElement) {
    obs.observe(document.documentElement, { childList: true, subtree: true })
  }

  // YouTube is a SPA; re-check the download button on soft navigations.
  window.addEventListener('yt-navigate-finish', ensureDownloadButton)
  setInterval(ensureDownloadButton, 3000)
})()
