// The random picker's maths (CLAUDE.md section 2, "Not sure? Spin the wheel"). Pure: no React, no randomness of its own.
// The wheel shows the top 12 hikes that fit, and a hike with a higher match % gets a wider slice, so it is more likely to win.

export const WHEEL_SIZE = 12

interface Scored {
  out: boolean
  result: { match: number }
}

/** The wheel's hikes: the best `n` that fit all limits, in rank order. `rows` must already be sorted best first. */
export const wheelRows = <T extends Scored>(rows: T[], n: number = WHEEL_SIZE): T[] => rows.filter((r) => !r.out).slice(0, n)

/** A slice's weight. Floored at 1 so a hike with a tiny match is still on the wheel. */
export const weightOf = (match: number) => Math.max(match, 1)

export interface Pick {
  index: number
  /** Where inside the winning slice the pointer stops, 0 to 1 (so the wheel can land anywhere in it, not always on the middle). */
  fraction: number
}

/** Chooses one row with probability proportional to its match %. `rng` returns a number in [0, 1), like Math.random. */
export function pickWeighted(rows: { match: number }[], rng: () => number = Math.random): Pick | null {
  if (rows.length === 0) return null
  const weights = rows.map((r) => weightOf(r.match))
  const total = weights.reduce((s, w) => s + w, 0)
  const target = Math.min(Math.max(rng(), 0), 1 - Number.EPSILON) * total
  let before = 0
  for (let i = 0; i < rows.length; i++) {
    if (target < before + weights[i] || i === rows.length - 1) return { index: i, fraction: Math.min(1, Math.max(0, (target - before) / weights[i])) }
    before += weights[i]
  }
  return null
}

export interface Slice {
  start: number // degrees clockwise from 12 o'clock
  end: number
}

/** Slice angles for the wheel, widths proportional to the same weights `pickWeighted` uses. */
export function sliceAngles(rows: { match: number }[]): Slice[] {
  const weights = rows.map((r) => weightOf(r.match))
  const total = weights.reduce((s, w) => s + w, 0)
  let angle = 0
  return weights.map((w) => {
    const start = angle
    angle += (w / total) * 360
    return { start, end: angle }
  })
}

/**
 * Final wheel rotation (degrees) that brings the picked point under the fixed pointer at 12 o'clock,
 * after at least `turns` full turns from the current rotation. Keeps the stop away from the slice edges.
 */
export function landingRotation(current: number, slice: Slice, fraction: number, turns = 5): number {
  const inner = 0.15 + fraction * 0.7
  const theta = slice.start + inner * (slice.end - slice.start)
  const delta = (((-theta - current) % 360) + 360) % 360
  return current + turns * 360 + delta
}
