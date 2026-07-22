import { getGuriCss, isAllowedLocation, normalizeGuriConfig, type GuriConfig } from '../lib/guri'

export const noutubeGuriEvent = 'noutube:guri'
const guriStyleId = 'noutube-guri'

// The webview never receives the PIN; only the enforcement flags.
type GuriContentConfig = Omit<GuriConfig, 'pin'>

let guri: GuriContentConfig = stripPin(normalizeGuriConfig(null))
let restrictedApplied = false

function stripPin(config: GuriConfig): GuriContentConfig {
  const { pin: _pin, ...rest } = config
  return rest
}

export function getGuri(): GuriContentConfig {
  return guri
}

function applyGuriStyle() {
  const style = document.querySelector<HTMLStyleElement>('#' + guriStyleId) || document.createElement('style')
  style.id = guriStyleId
  style.type = 'text/css'
  style.textContent = getGuriCss(guri)
  ;(document.head || document.documentElement).appendChild(style)
}

// Best-effort YouTube Restricted Mode via the PREF cookie's f2 bitfield.
function applyRestrictedMode() {
  if (!guri.enabled || !guri.restrictedMode) return
  try {
    const match = document.cookie.match(/(?:^|;\s*)PREF=([^;]*)/)
    const pref = match ? decodeURIComponent(match[1]) : ''
    const params = new URLSearchParams(pref)
    if (params.get('f2') === '8000000') {
      restrictedApplied = true
      return
    }
    params.set('f2', '8000000')
    document.cookie = `PREF=${params.toString()}; path=/; domain=.youtube.com; max-age=${60 * 60 * 24 * 365}`
    if (!restrictedApplied) {
      restrictedApplied = true
      location.reload()
    }
  } catch {
    // cookies may be unavailable; the CSS restrictions still apply
  }
}

// "Só isso aqui": redirect anything outside the allow-list back to the first
// allowed channel/playlist. This is the reliable enforcement (CSS just hides
// the entry points). YouTube is an SPA, so we watch its navigation events plus
// poll the URL as a safety net.
function safeHomeUrl(): string | null {
  const first = guri.allowList?.[0]
  return first?.url || null
}

function enforceAllowList() {
  if (!guri.enabled || !guri.allowListMode || !guri.allowList?.length) return
  const host = location.host
  if (host !== 'm.youtube.com' && host !== 'www.youtube.com') return
  if (isAllowedLocation(location.pathname, location.search, guri.allowList as any)) return

  const target = safeHomeUrl()
  if (!target) return
  try {
    // Avoid redirect loops when already on the safe-home path.
    if (new URL(target).pathname === location.pathname) return
  } catch {
    // ignore
  }
  location.replace(target)
}

let guardStarted = false
function startAllowListGuard() {
  if (guardStarted) return
  guardStarted = true
  const check = () => enforceAllowList()
  window.addEventListener('yt-navigate-finish', check)
  window.addEventListener('yt-navigate-start', check)
  window.addEventListener('popstate', check)
  let lastHref = location.href
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href
      check()
    }
  }, 400)
  check()
}

export function setGuri(next?: Partial<GuriConfig>): GuriContentConfig {
  guri = stripPin(normalizeGuriConfig(next))
  applyGuriStyle()
  applyRestrictedMode()
  enforceAllowList()
  window.dispatchEvent(new CustomEvent(noutubeGuriEvent, { detail: guri }))
  return guri
}

export function initGuri() {
  const initial = (window as any).NouTubeGuri
  if (initial) {
    guri = stripPin(normalizeGuriConfig(initial))
  }
  applyGuriStyle()
  applyRestrictedMode()
  startAllowListGuard()
  window.addEventListener(noutubeGuriEvent, applyGuriStyle)
}
