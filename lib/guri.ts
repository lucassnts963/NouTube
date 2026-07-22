// "Modo guri" — parental controls shared between the RN app and the injected
// content bundle. Keep this file dependency-free so content/guri.ts can import
// it into the webview bundle (same pattern as lib/user-styles.ts).

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
}

export const createDefaultGuriConfig = (): GuriConfig => ({
  enabled: false,
  pin: '',
  restrictedMode: true,
  hideShorts: true,
  hideSearch: true,
  hideComments: true,
  hideRecommendations: false,
})

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
  }
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

/** CSS injected into the webview to enforce the enabled restrictions. */
export const getGuriCss = (config?: Partial<GuriConfig> | null): string => {
  const c = normalizeGuriConfig(config)
  if (!c.enabled) return ''
  const parts: string[] = []
  if (c.hideShorts) parts.push(SHORTS_CSS.trim())
  if (c.hideSearch) parts.push(SEARCH_CSS.trim())
  if (c.hideComments) parts.push(COMMENTS_CSS.trim())
  if (c.hideRecommendations) parts.push(RECOMMENDATIONS_CSS.trim())
  return parts.join('\n\n')
}
