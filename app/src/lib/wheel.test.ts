import { describe, expect, it } from 'vitest'
import { landingRotation, pickWeighted, sliceAngles, WHEEL_SIZE, weightOf, wheelRows } from './wheel'

const rows = (matches: number[]) => matches.map((match) => ({ match }))

describe('pickWeighted', () => {
  it('returns null for an empty wheel', () => {
    expect(pickWeighted([], () => 0.5)).toBeNull()
  })
  it('walks the slices in order: the same random number always gives the same hike', () => {
    const r = rows([50, 30, 20]) // 50% / 30% / 20% of the wheel
    expect(pickWeighted(r, () => 0)?.index).toBe(0)
    expect(pickWeighted(r, () => 0.49)?.index).toBe(0)
    expect(pickWeighted(r, () => 0.5)?.index).toBe(1)
    expect(pickWeighted(r, () => 0.79)?.index).toBe(1)
    expect(pickWeighted(r, () => 0.8)?.index).toBe(2)
    expect(pickWeighted(r, () => 0.999999)?.index).toBe(2)
  })
  it('reports where inside the slice the pointer stops', () => {
    const p = pickWeighted(rows([50, 50]), () => 0.75)!
    expect(p.index).toBe(1)
    expect(p.fraction).toBeCloseTo(0.5)
  })
  it('is weighted by match %: over many draws a 90% hike wins about 9x as often as a 10% one', () => {
    const r = rows([90, 10])
    let seed = 12345
    const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296) // deterministic LCG
    const wins = [0, 0]
    for (let i = 0; i < 20000; i++) wins[pickWeighted(r, rng)!.index]++
    expect(wins[0] / 20000).toBeGreaterThan(0.88)
    expect(wins[0] / 20000).toBeLessThan(0.92)
  })
  it('a 0% hike still has a sliver (weight floor of 1), so the wheel never divides by zero', () => {
    expect(weightOf(0)).toBe(1)
    expect(pickWeighted(rows([0, 0, 0]), () => 0.5)?.index).toBe(1) // all zero: equal slices
  })
})

describe('wheelRows', () => {
  const mk = (n: number, out = false) => Array.from({ length: n }, (_, i) => ({ id: i, out, result: { match: 100 - i } }))
  it('keeps the top 12 that fit, in rank order', () => {
    const r = wheelRows(mk(30))
    expect(r).toHaveLength(WHEEL_SIZE)
    expect(r[0].id).toBe(0)
  })
  it('skips hikes past a limit, and may have fewer than 12', () => {
    const all = [...mk(3), ...mk(5, true)]
    expect(wheelRows(all)).toHaveLength(3)
    expect(wheelRows(mk(5, true))).toEqual([])
  })
})

describe('sliceAngles and landingRotation', () => {
  it('slices cover the full circle and are proportional to match', () => {
    const s = sliceAngles(rows([75, 25]))
    expect(s[0]).toEqual({ start: 0, end: 270 })
    expect(s[1].end).toBeCloseTo(360)
  })
  it('lands the picked slice under the pointer, after at least 5 full turns', () => {
    const slices = sliceAngles(rows([25, 25, 25, 25]))
    for (const current of [0, 123.4, 2000]) {
      for (let i = 0; i < slices.length; i++) {
        for (const fraction of [0, 0.5, 1]) {
          const end = landingRotation(current, slices[i], fraction)
          expect(end - current).toBeGreaterThanOrEqual(5 * 360)
          // the wheel point now under 12 o'clock is (-end) mod 360: it must lie inside slice i
          const under = (((-end) % 360) + 360) % 360
          expect(under).toBeGreaterThan(slices[i].start)
          expect(under).toBeLessThan(slices[i].end)
        }
      }
    }
  })
})
