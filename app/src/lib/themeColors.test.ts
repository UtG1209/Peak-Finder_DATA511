import { describe, expect, it } from 'vitest'
import { resolveMapColors } from './themeColors'
import { DIFFICULTY_BY_THEME } from './difficulty'
import { contrast } from './contrast'
import { themes } from '../test/tokens'

const reader = (theme: 'light' | 'dark') => (n: string) => themes[theme][n] ?? ''

describe.each(['light', 'dark'] as const)('map colours, %s theme', (theme) => {
  const c = resolveMapColors(reader(theme), theme)
  it('come from the tokens of that theme', () => {
    expect(c.land).toBe(themes[theme]['--map-land'])
    expect(c.sea).toBe(themes[theme]['--map-sea'])
    expect(c.ink).toBe(themes[theme]['--text'])
    expect(c.diff).toEqual(DIFFICULTY_BY_THEME[theme])
  })
  it('keep every marker colour >= 3:1 against the land', () => {
    for (const [name, col] of Object.entries({ ...c.diff, off: c.off, ink: c.ink })) {
      expect(contrast(col, c.land), `${name} on land`).toBeGreaterThanOrEqual(3)
    }
  })
  it('keep the highlight ring and halo apart from each other', () => {
    expect(contrast(c.ink, c.halo)).toBeGreaterThanOrEqual(7)
  })
})

describe('resolveMapColors', () => {
  it('falls back to a named colour when a token is missing', () => {
    expect(resolveMapColors(() => '', 'dark').land).toBe('gray')
  })
  it('differs between themes', () => {
    expect(resolveMapColors(reader('light'), 'light').land).not.toBe(resolveMapColors(reader('dark'), 'dark').land)
  })
})
