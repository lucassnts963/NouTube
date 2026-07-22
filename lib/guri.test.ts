import { describe, expect, it } from 'bun:test'
import { getGuriCss, isValidGuriPin, normalizeGuriConfig, createDefaultGuriConfig } from './guri'

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
