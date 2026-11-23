import { describe, expect, it } from 'vitest'
import type { HikeMonth } from '../../../data/schema'
import { barLayout, monthSeries } from './layout'

const box = { width: 200, height: 100, left: 10, right: 10, top: 10, bottom: 20 }

describe('dashboard layout', () => {
  it('bar heights are proportional and sit on the baseline', () => {
    const bars = barLayout([50, 100, 0, 25], box, 100)
    expect(bars).toHaveLength(4)
    expect(bars[1].h).toBeCloseTo(70, 5) // full bar = 100 - top 10 - bottom 20
    expect(bars[0].h).toBeCloseTo(35, 5)
    expect(bars[2].h).toBeCloseTo(0, 5)
    for (const b of bars) expect(b.y + b.h).toBeCloseTo(80, 5)
    expect(bars[0].x).toBeLessThan(bars[1].x)
  })
  it('null and out-of-range values are clamped, never negative', () => {
    const bars = barLayout([null, 500, -4], box, 100)
    expect(bars.every((b) => b.h >= 0 && b.h <= 70.0001)).toBe(true)
    expect(bars[0].value).toBe(0)
  })
  it('monthSeries returns 12 entries and keeps missing as null', () => {
    const rows = [
      { month: 3, crowd_level: 0.4, smoky_days: 1.5, missing: [] },
      { month: 8, crowd_level: 0.9, smoky_days: 4, missing: ['smoky'] },
    ] as unknown as HikeMonth[]
    const s = monthSeries(rows)
    expect(s).toHaveLength(12)
    expect(s[2]).toEqual({ month: 3, crowd: 0.4, smoky: 1.5 })
    expect(s[7]).toEqual({ month: 8, crowd: 0.9, smoky: null })
    expect(s[0]).toEqual({ month: 1, crowd: null, smoky: null })
  })
})
