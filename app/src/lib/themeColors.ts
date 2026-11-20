// Resolved colours for canvas code (2D map markers, 3D scene), per theme. Canvas and WebGL cannot use var(), so we read the tokens
// from the computed style and re-resolve when the theme changes. Difficulty colours come from DIFFICULTY_BY_THEME (kept equal to --diff-* by a test).
import { useMemo } from 'react'
import { DIFFICULTY_BY_THEME, type Difficulty, type ThemeName } from './difficulty'
import { readToken, useTheme } from './theme'

export interface MapColors {
  sea: string
  land: string
  border: string
  label: string
  /** Strongest text colour: used for the hover/selected ring and the 3D-walk outline (contrasts with land in both themes). */
  ink: string
  /** Halo around markers so overlapping peaks stay apart. */
  halo: string
  /** Outline of a filtered-out (hollow grey) peak. */
  off: string
  diff: Record<Difficulty, string>
}

const FALLBACK = 'gray' // only reached where there is no stylesheet (unit tests without a reader)

/** Pure: build the colour set from a token reader. */
export function resolveMapColors(read: (name: string) => string, theme: ThemeName): MapColors {
  const t = (name: string) => read(name) || FALLBACK
  return {
    sea: t('--map-sea'),
    land: t('--map-land'),
    border: t('--map-border'),
    label: t('--map-label'),
    ink: t('--text'),
    halo: t('--surface'),
    off: t('--off-line'),
    diff: DIFFICULTY_BY_THEME[theme],
  }
}

/** Colours for the current theme; a new object (so effects re-run) exactly when the theme changes. */
export function useMapColors(): MapColors {
  const [theme] = useTheme()
  return useMemo(() => resolveMapColors((n) => readToken(n), theme), [theme])
}
