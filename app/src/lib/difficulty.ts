// One colour per difficulty, used for the map bubbles, the legend, list dots, chips and the hike page.
// Chosen to stay apart for common colour-vision differences (no red/green pair): light teal, gold, violet.
// Colour is never the only signal: every use also shows the word.
import type { Hike } from '../data/schema'

export type Difficulty = Hike['difficulty']

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#5eead4',
  moderate: '#f2c14e',
  hard: '#a56bff',
}
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' }

/** Publish the colours as CSS variables (--diff-easy, ...) so stylesheets and the map share one source. */
export function applyDifficultyVars(root: HTMLElement = document.documentElement) {
  for (const d of Object.keys(DIFFICULTY_COLORS) as Difficulty[]) root.style.setProperty(`--diff-${d}`, DIFFICULTY_COLORS[d])
}

export const hexToRgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
