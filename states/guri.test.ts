import { describe, expect, it, beforeEach } from 'bun:test'
import { guri$, getGuriContentSnapshot } from './guri'

describe('guri$', () => {
  beforeEach(() => {
    guri$.enabled.set(false)
    guri$.pin.set('')
  })

  it('enable requires a valid PIN and turns the mode on', () => {
    expect(guri$.enable('12')).toBe(false)
    expect(guri$.enabled.get()).toBe(false)

    expect(guri$.enable('4321')).toBe(true)
    expect(guri$.enabled.get()).toBe(true)
    expect(guri$.pin.get()).toBe('4321')
  })

  it('verifyPin matches only the set PIN', () => {
    guri$.enable('1357')
    expect(guri$.verifyPin('1357')).toBe(true)
    expect(guri$.verifyPin('0000')).toBe(false)
    expect(guri$.verifyPin('')).toBe(false)
  })

  it('disable needs the correct PIN', () => {
    guri$.enable('2468')
    expect(guri$.disable('0000')).toBe(false)
    expect(guri$.enabled.get()).toBe(true)
    expect(guri$.disable('2468')).toBe(true)
    expect(guri$.enabled.get()).toBe(false)
  })

  it('setPin requires the current PIN and a valid new one', () => {
    guri$.enable('1111')
    expect(guri$.setPin('0000', '2222')).toBe(false)
    expect(guri$.setPin('1111', '99')).toBe(false)
    expect(guri$.setPin('1111', '2222')).toBe(true)
    expect(guri$.verifyPin('2222')).toBe(true)
  })

  it('content snapshot never leaks the PIN', () => {
    guri$.enable('7777')
    const snap = getGuriContentSnapshot()
    expect('pin' in snap).toBe(false)
    expect(snap.enabled).toBe(true)
  })

  it('adds and dedupes allow-list items, rejecting junk', () => {
    guri$.allowList.set([])
    expect(guri$.addAllowItem('https://m.youtube.com/@Guri')).toBe(true)
    expect(guri$.addAllowItem('https://m.youtube.com/@Guri')).toBe(true) // dedupe
    expect(guri$.addAllowItem('https://example.com')).toBe(false)
    expect(guri$.allowList.get()).toHaveLength(1)

    const id = guri$.allowList.get()[0].id
    guri$.removeAllowItem(id)
    expect(guri$.allowList.get()).toHaveLength(0)
  })
})
