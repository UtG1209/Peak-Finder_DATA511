import { describe, expect, it } from 'vitest'
import { colourDistance, contrast } from './contrast'
import { darkMediaOverrides, darkOverrides, themes } from '../test/tokens'

// Guards styles/tokens.css for BOTH themes. Thresholds:
//   text on its surface >= 4.5:1 (WCAG AA); control borders and difficulty marks >= 3:1 (WCAG 1.4.11);
//   difficulty colours pairwise CIE76 delta-E >= 30 as seen with deuteranopia and protanopia (20+ is "clearly different colours"; we ask for margin because the marks are small).
const TEXT_ROLES = ['--text', '--text-body', '--text-muted', '--off-text', '--accent-text']
const SURFACES = ['--bg', '--surface', '--surface-2']
const MIN_CVD_DISTANCE = 30

const hex = (t: Record<string, string>, name: string) => {
  const v = t[name]
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`token ${name} is missing or not a 6-digit hex: ${v}`)
  return v
}

describe.each(['light', 'dark'] as const)('%s theme', (name) => {
  const t = themes[name]

  it.each(TEXT_ROLES.flatMap((fg) => SURFACES.map((bg) => [fg, bg])))('%s on %s >= 4.5:1', (fg, bg) => {
    expect(contrast(hex(t, fg), hex(t, bg))).toBeGreaterThanOrEqual(4.5)
  })

  it('text on the sunk and hover/selected backgrounds that hold text (list rows, wells) >= 4.5:1', () => {
    for (const bg of ['--hover', '--selected', '--surface-sunk']) {
      for (const fg of ['--text', '--text-body']) expect(contrast(hex(t, fg), hex(t, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
    for (const bg of ['--hover', '--selected']) expect(contrast(hex(t, '--accent-text'), hex(t, bg)), `accent-text on ${bg}`).toBeGreaterThanOrEqual(4.5)
  })

  it('button text on accent, and on accent hover >= 4.5:1', () => {
    expect(contrast(hex(t, '--on-accent'), hex(t, '--accent'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--on-accent'), hex(t, '--accent-hover'))).toBeGreaterThanOrEqual(4.5)
  })

  it('hazard text and banner text are readable on their backgrounds', () => {
    expect(contrast(hex(t, '--hazard'), hex(t, '--surface'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--hazard'), hex(t, '--bg'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--banner-text'), hex(t, '--banner-bg'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--error'), hex(t, '--surface'))).toBeGreaterThanOrEqual(4.5)
  })

  it('hike page: hazard, muted and accent text on the chosen-month tint, the grey cell and the daylight band >= 4.5:1', () => {
    for (const bg of ['--selected', '--surface-sunk', '--hazard-soft']) {
      expect(contrast(hex(t, '--hazard'), hex(t, bg)), `hazard on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(hex(t, '--text'), hex(t, bg)), `text on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(hex(t, '--off-text'), hex(t, '--surface-sunk')), 'off-text on surface-sunk').toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--text-muted'), hex(t, '--selected')), 'muted on selected').toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--accent-text'), hex(t, '--selected')), 'accent-text on selected').toBeGreaterThanOrEqual(4.5)
  })

  it('chart marks (profile line, hiker, hazard band edge) are >= 3:1 on the page', () => {
    for (const c of ['--accent', '--text', '--hazard']) expect(contrast(hex(t, c), hex(t, '--bg')), c).toBeGreaterThanOrEqual(3)
    expect(contrast(hex(t, '--hazard'), hex(t, '--hazard-soft')), 'hazard on hazard-soft').toBeGreaterThanOrEqual(3)
  })

  it('control borders and off-state strokes >= 3:1 on surfaces', () => {
    for (const bg of SURFACES) {
      expect(contrast(hex(t, '--line-strong'), hex(t, bg)), `line-strong on ${bg}`).toBeGreaterThanOrEqual(3)
      expect(contrast(hex(t, '--off-line'), hex(t, bg)), `off-line on ${bg}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('cost-bar label text is readable on every category fill', () => {
    for (const c of ['--cat-1', '--cat-2', '--cat-3', '--cat-4']) expect(contrast(hex(t, '--on-cat'), hex(t, c)), c).toBeGreaterThanOrEqual(4.5)
  })

  it('cost categories are >= 3:1 on the surface', () => {
    for (const c of ['--cat-1', '--cat-2', '--cat-3', '--cat-4']) expect(contrast(hex(t, c), hex(t, '--surface')), c).toBeGreaterThanOrEqual(3)
  })

  const DIFFS = ['--diff-easy', '--diff-moderate', '--diff-hard']
  it.each(DIFFS)('%s is >= 3:1 on the map land', (d) => {
    expect(contrast(hex(t, d), hex(t, '--map-land'))).toBeGreaterThanOrEqual(3)
  })

  it('map border and label are visible on the land', () => {
    expect(contrast(hex(t, '--map-label'), hex(t, '--map-land'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hex(t, '--map-border'), hex(t, '--map-land'))).toBeGreaterThan(1.3)
  })

  it.each([undefined, 'deuteranopia', 'protanopia'] as const)('difficulty colours are pairwise distinguishable (%s)', (kind) => {
    const pairs: [string, string][] = [['--diff-easy', '--diff-moderate'], ['--diff-easy', '--diff-hard'], ['--diff-moderate', '--diff-hard']]
    for (const [a, b] of pairs) expect(colourDistance(hex(t, a), hex(t, b), kind), `${a} vs ${b}`).toBeGreaterThanOrEqual(MIN_CVD_DISTANCE)
  })
})

describe('tokens.css structure', () => {
  it('the prefers-color-scheme fallback block is identical to the data-theme="dark" block', () => {
    expect(darkMediaOverrides).toEqual(darkOverrides)
    expect(Object.keys(darkOverrides).length).toBeGreaterThan(30)
  })
  it('dark overrides only tokens the light theme defines', () => {
    for (const k of Object.keys(darkOverrides)) expect(themes.light[k], k).toBeDefined()
  })
})
