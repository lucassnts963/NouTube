// "Modo guri" — parental controls shared between the RN app and the injected
// content bundle. Keep this file dependency-free so content/guri.ts can import
// it into the webview bundle (same pattern as lib/user-styles.ts).

/** A channel or playlist the child is allowed to watch in "só isso aqui" mode. */
export interface GuriAllowItem {
  id: string
  type: 'channel' | 'playlist'
  /** Canonical matcher: 'channel/UC…' | '@handle' | 'c/name' | 'user/name' | playlist id. */
  key: string
  title: string
  /** Normalized m.youtube.com url to open the item. */
  url: string
}

export interface GuriConfig {
  /** Parental mode is active. */
  enabled: boolean
  /** 4+ digit PIN that unlocks settings / disables the mode. */
  pin: string
  /** Force YouTube Restricted Mode (best-effort, via the PREF cookie). */
  restrictedMode: boolean
  hideShorts: boolean
  hideSearch: boolean
  hideComments: boolean
  hideRecommendations: boolean
  /** "Só isso aqui": only the allow-listed channels/playlists (and videos) are reachable. */
  allowListMode: boolean
  allowList: GuriAllowItem[]
}

export const createDefaultGuriConfig = (): GuriConfig => ({
  enabled: false,
  pin: '',
  restrictedMode: true,
  hideShorts: true,
  hideSearch: true,
  hideComments: true,
  hideRecommendations: false,
  allowListMode: false,
  allowList: [],
})

const normalizeAllowList = (value: unknown): GuriAllowItem[] => {
  if (!Array.isArray(value)) return []
  const out: GuriAllowItem[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Partial<GuriAllowItem>
    if ((item.type !== 'channel' && item.type !== 'playlist') || typeof item.key !== 'string' || !item.key) continue
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id : item.key,
      type: item.type,
      key: item.key,
      title: typeof item.title === 'string' ? item.title : item.key,
      url: typeof item.url === 'string' ? item.url : '',
    })
  }
  return out
}

export const normalizeGuriConfig = (value?: Partial<GuriConfig> | null): GuriConfig => {
  const d = createDefaultGuriConfig()
  if (!value || typeof value !== 'object') return d
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : d.enabled,
    pin: typeof value.pin === 'string' ? value.pin : d.pin,
    restrictedMode: typeof value.restrictedMode === 'boolean' ? value.restrictedMode : d.restrictedMode,
    hideShorts: typeof value.hideShorts === 'boolean' ? value.hideShorts : d.hideShorts,
    hideSearch: typeof value.hideSearch === 'boolean' ? value.hideSearch : d.hideSearch,
    hideComments: typeof value.hideComments === 'boolean' ? value.hideComments : d.hideComments,
    hideRecommendations:
      typeof value.hideRecommendations === 'boolean' ? value.hideRecommendations : d.hideRecommendations,
    allowListMode: typeof value.allowListMode === 'boolean' ? value.allowListMode : d.allowListMode,
    allowList: normalizeAllowList(value.allowList),
  }
}

/**
 * Parse a YouTube channel or playlist URL into an allow-list matcher.
 * Returns null for anything that isn't a pinnable channel/playlist.
 */
export const parseAllowItem = (rawUrl: string): Pick<GuriAllowItem, 'type' | 'key' | 'url'> | null => {
  let u: URL
  try {
    u = new URL(rawUrl.trim())
  } catch {
    return null
  }
  const host = u.host.toLowerCase()
  if (!/(^|\.)youtube\.com$/.test(host) && host !== 'youtu.be') return null

  const list = u.searchParams.get('list')
  const path = u.pathname.replace(/\/+$/, '')

  if (list && (path === '' || path === '/playlist' || path === '/watch')) {
    return { type: 'playlist', key: list, url: `https://m.youtube.com/playlist?list=${list}` }
  }

  let m: RegExpMatchArray | null
  if ((m = path.match(/^\/channel\/(UC[\w-]+)/))) {
    return { type: 'channel', key: `channel/${m[1]}`, url: `https://m.youtube.com/channel/${m[1]}` }
  }
  if ((m = path.match(/^\/(@[\w.-]+)/))) {
    return { type: 'channel', key: m[1], url: `https://m.youtube.com/${m[1]}` }
  }
  if ((m = path.match(/^\/(c\/[\w.-]+)/))) {
    return { type: 'channel', key: m[1], url: `https://m.youtube.com/${m[1]}` }
  }
  if ((m = path.match(/^\/(user\/[\w.-]+)/))) {
    return { type: 'channel', key: m[1], url: `https://m.youtube.com/${m[1]}` }
  }
  return null
}

/**
 * Whether a location is reachable under the allow-list. Watch pages are always
 * allowed (a video can't be attributed to a channel cheaply); with search/home
 * hidden, the child only reaches videos through allow-listed content.
 */
export const isAllowedLocation = (pathname: string, searchStr: string, allowList: GuriAllowItem[]): boolean => {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/watch') return true
  let list: string | null = null
  try {
    list = new URLSearchParams(searchStr || '').get('list')
  } catch {
    list = null
  }
  for (const item of allowList) {
    if (item.type === 'playlist') {
      if (list && list === item.key) return true
    } else {
      const k = '/' + item.key
      if (path === k || path.startsWith(k + '/')) return true
    }
  }
  return false
}

export const isValidGuriPin = (pin: string): boolean => /^\d{4,8}$/.test(pin)

// Selectors are best-effort (YouTube's markup shifts over time), matching both
// the mobile (ytm-*) and desktop (ytd-*) DOM — same trade-off as user-styles.
const SHORTS_CSS = `
  ytm-reel-shelf-renderer,
  ytd-reel-shelf-renderer,
  ytd-rich-shelf-renderer[is-shorts],
  ytm-pivot-bar-item-renderer:has(.pivot-shorts),
  ytd-mini-guide-entry-renderer:has(a[title="Shorts" i]),
  ytd-guide-entry-renderer:has(a[title="Shorts" i]),
  ytm-rich-section-renderer:has([href^="/shorts"]),
  a[href^="/shorts"] {
    display: none !important;
  }
`

const SEARCH_CSS = `
  ytm-searchbox,
  .searchbox,
  ytd-searchbox,
  #search-icon-legacy,
  button[aria-label="Search" i],
  button[aria-label="Pesquisar" i],
  ytm-mobile-topbar-renderer .topbar-menu-button-avatar-button ~ *[role="button"][aria-label*="earch" i] {
    display: none !important;
  }
`

const COMMENTS_CSS = `
  #comments,
  ytd-comments,
  ytm-comment-section-renderer,
  ytm-item-section-renderer:has(ytm-comment-thread-renderer),
  ytd-item-section-renderer:has(ytd-comment-thread-renderer) {
    display: none !important;
  }
`

const RECOMMENDATIONS_CSS = `
  #related,
  ytd-watch-next-secondary-results-renderer,
  ytm-single-column-watch-next-results-renderer ytm-item-section-renderer:has(ytm-video-with-context-renderer) {
    display: none !important;
  }
`

// "Só isso aqui": strip every way out of the allow-listed content — the bottom
// pivot bar (Home/Explore/Shorts/Subscriptions/Library), the home logo and the
// search entry. Navigation is still enforced by the redirect guard in
// content/guri.ts; this just removes the temptation.
const ALLOWLIST_CSS = `
  ytm-pivot-bar-renderer,
  ytd-mini-guide-renderer,
  #guide-button,
  ytm-mobile-topbar-renderer .topbar-logo,
  ytd-topbar-logo-renderer,
  a[href="/"],
  ytm-searchbox,
  .searchbox,
  ytd-searchbox,
  #search-icon-legacy,
  button[aria-label="Search" i],
  button[aria-label="Pesquisar" i] {
    display: none !important;
  }
`

/** CSS injected into the webview to enforce the enabled restrictions. */
export const getGuriCss = (config?: Partial<GuriConfig> | null): string => {
  const c = normalizeGuriConfig(config)
  if (!c.enabled) return ''
  const parts: string[] = []
  if (c.hideShorts) parts.push(SHORTS_CSS.trim())
  if (c.hideSearch) parts.push(SEARCH_CSS.trim())
  if (c.hideComments) parts.push(COMMENTS_CSS.trim())
  if (c.hideRecommendations) parts.push(RECOMMENDATIONS_CSS.trim())
  if (c.allowListMode && c.allowList.length > 0) parts.push(ALLOWLIST_CSS.trim())
  return parts.join('\n\n')
}
