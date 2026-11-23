// One colour per difficulty, used for the map bubbles, the legend, list dots, chips and the hike page.
// Light teal / gold / violet by name, desaturated, retuned per theme: each is >= 3:1 against that theme's map land colour and the three stay
// apart under deuteranopia and protanopia (checked by lib/contrast.test.ts). No red/green pair. Colour is never the only signal: every use also shows the word.
// SINGLE SOURCE OF TRUTH is this file for TypeScript and styles/tokens.css (--diff-*) for CSS; difficulty.test.ts fails if they drift.
import type { Hike } from '../data/schema'

export type Difficulty = Hike['difficulty']
export type ThemeName = 'dark' | 'light'

export const DIFFICULTY_BY_THEME: Record<ThemeName, Record<Difficulty, string>> = {
  dark: { easy: '#68c9b8', moderate: '#d9a441', hard: '#a58be8' },
  light: { easy: '#0f7a6e', moderate: '#946400', hard: '#6a4cc4' },
}

/** The dark set. Canvas code (map markers, 3D scene) still reads this; a later worker migrates it to DIFFICULTY_BY_THEME or readToken('--diff-easy'). */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = DIFFICULTY_BY_THEME.dark
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' }

/** Deprecated: the CSS variables (--diff-easy, ...) now come from styles/tokens.css per theme. Only call this to force a set on an element. */
export function applyDifficultyVars(root: HTMLElement = document.documentElement, theme: ThemeName = 'dark') {
  for (const d of Object.keys(DIFFICULTY_BY_THEME[theme]) as Difficulty[]) root.style.setProperty(`--diff-${d}`, DIFFICULTY_BY_THEME[theme][d])
}

export const hexToRgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
