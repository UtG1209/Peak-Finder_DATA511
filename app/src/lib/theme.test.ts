import { describe, expect, it } from 'vitest'
import { otherTheme, parseTheme, resolveTheme } from './theme'

describe('theme (pure parts)', () => {
  it('parseTheme accepts only light or dark', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    for (const bad of [null, undefined, '', 'auto', 'DARK', 1, {}]) expect(parseTheme(bad)).toBeNull()
  })
  it('resolveTheme: a stored choice beats the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('resolveTheme: with no stored choice it follows the system', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })
  it('otherTheme flips', () => {
    expect(otherTheme('dark')).toBe('light')
    expect(otherTheme('light')).toBe('dark')
  })
})
