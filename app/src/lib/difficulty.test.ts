import { describe, expect, it } from 'vitest'
import { DIFFICULTY_BY_THEME, DIFFICULTY_COLORS, type Difficulty } from './difficulty'
import { themes } from '../test/tokens'

describe('difficulty colours: one source of truth', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const d of ['easy', 'moderate', 'hard'] as Difficulty[]) {
      it(`--diff-${d} in tokens.css equals DIFFICULTY_BY_THEME.${theme}.${d}`, () => {
        expect(themes[theme][`--diff-${d}`].toLowerCase()).toBe(DIFFICULTY_BY_THEME[theme][d].toLowerCase())
      })
    }
  }
  it('DIFFICULTY_COLORS still points at the dark set', () => {
    expect(DIFFICULTY_COLORS).toBe(DIFFICULTY_BY_THEME.dark)
  })
})
