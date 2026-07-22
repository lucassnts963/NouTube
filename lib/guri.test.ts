import { describe, expect, it } from 'bun:test'
import {
  getGuriCss,
  isValidGuriPin,
  normalizeGuriConfig,
  createDefaultGuriConfig,
  parseAllowItem,
  isAllowedLocation,
  type GuriAllowItem,
} from './guri'

describe('isValidGuriPin', () => {
  it('accepts 4 to 8 digit PINs', () => {
    expect(isValidGuriPin('1234')).toBe(true)
    expect(isValidGuriPin('12345678')).toBe(true)
    expect(isValidGuriPin('123')).toBe(false)
    expect(isValidGuriPin('123456789')).toBe(false)
    expect(isValidGuriPin('12a4')).toBe(false)
    expect(isValidGuriPin('')).toBe(false)
  })
})

describe('normalizeGuriConfig', () => {
  it('fills defaults for missing/invalid values', () => {
    const c = normalizeGuriConfig({ enabled: true } as any)
    expect(c.enabled).toBe(true)
    expect(c.hideShorts).toBe(true)
    expect(c).toEqual({ ...createDefaultGuriConfig(), enabled: true })
  })

  it('handles null', () => {
    expect(normalizeGuriConfig(null)).toEqual(createDefaultGuriConfig())
  })
})

describe('getGuriCss', () => {
  it('returns nothing when disabled', () => {
    expect(getGuriCss({ enabled: false, hideShorts: true })).toBe('')
  })

  it('includes only the enabled restrictions', () => {
    const css = getGuriCss({
      enabled: true,
      hideShorts: true,
      hideSearch: false,
      hideComments: true,
      hideRecommendations: false,
    })
    expect(css).toContain('shorts')
    expect(css).toContain('#comments')
    expect(css).not.toContain('searchbox')
    expect(css).not.toContain('#related')
  })

  it('hides everything when all flags on', () => {
    const css = getGuriCss({
      enabled: true,
      hideShorts: true,
      hideSearch: true,
      hideComments: true,
      hideRecommendations: true,
    })
    expect(css).toContain('shorts')
    expect(css).toContain('searchbox')
    expect(css).toContain('#comments')
    expect(css).toContain('#related')
  })
})

describe('parseAllowItem', () => {
  it('parses channels in every URL form', () => {
    expect(parseAllowItem('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')).toEqual({
      type: 'channel',
      key: 'channel/UCabcdefghijklmnopqrstuv',
      url: 'https://m.youtube.com/channel/UCabcdefghijklmnopqrstuv',
    })
    expect(parseAllowItem('https://m.youtube.com/@Guri')?.key).toBe('@Guri')
    expect(parseAllowItem('https://youtube.com/c/SomeName')?.key).toBe('c/SomeName')
    expect(parseAllowItem('https://youtube.com/user/legacy')?.key).toBe('user/legacy')
  })

  it('parses playlists from playlist and watch urls', () => {
    expect(parseAllowItem('https://m.youtube.com/playlist?list=PL123')).toEqual({
      type: 'playlist',
      key: 'PL123',
      url: 'https://m.youtube.com/playlist?list=PL123',
    })
    expect(parseAllowItem('https://www.youtube.com/watch?v=abc&list=PL999')?.type).toBe('playlist')
    expect(parseAllowItem('https://www.youtube.com/watch?v=abc&list=PL999')?.key).toBe('PL999')
  })

  it('rejects non-channel/playlist and non-youtube urls', () => {
    expect(parseAllowItem('https://www.youtube.com/')).toBeNull()
    expect(parseAllowItem('https://www.youtube.com/feed/trending')).toBeNull()
    expect(parseAllowItem('https://example.com/@Guri')).toBeNull()
    expect(parseAllowItem('not a url')).toBeNull()
  })
})

describe('isAllowedLocation', () => {
  const list: GuriAllowItem[] = [
    { id: '1', type: 'channel', key: '@Guri', title: 'Guri', url: '' },
    { id: '2', type: 'playlist', key: 'PL42', title: 'PL', url: '' },
  ]

  it('always allows watch pages', () => {
    expect(isAllowedLocation('/watch', '?v=abc', list)).toBe(true)
    expect(isAllowedLocation('/watch', '?v=abc&list=PLother', list)).toBe(true)
  })

  it('allows the listed channel and its subpages', () => {
    expect(isAllowedLocation('/@Guri', '', list)).toBe(true)
    expect(isAllowedLocation('/@Guri/videos', '', list)).toBe(true)
    expect(isAllowedLocation('/@Other', '', list)).toBe(false)
  })

  it('allows the listed playlist by list param', () => {
    expect(isAllowedLocation('/playlist', '?list=PL42', list)).toBe(true)
    expect(isAllowedLocation('/playlist', '?list=PLnope', list)).toBe(false)
  })

  it('blocks home, search and feed', () => {
    expect(isAllowedLocation('/', '', list)).toBe(false)
    expect(isAllowedLocation('/results', '?search_query=x', list)).toBe(false)
    expect(isAllowedLocation('/feed/trending', '', list)).toBe(false)
  })
})
