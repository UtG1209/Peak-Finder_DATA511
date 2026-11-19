import { describe, expect, it } from 'vitest'
import { bubbleRadius } from './bubbles'

describe('bubbleRadius', () => {
  it('makes AREA proportional to match', () => {
    const area = (m: number) => Math.PI * bubbleRadius(m, false) ** 2
    expect(area(100) / area(64)).toBeCloseTo(100 / 64, 5)
  })
  it('never lets a fitting bubble vanish', () => expect(bubbleRadius(0.5, false)).toBeGreaterThanOrEqual(4))
  it('draws a failing hike as a small fixed dot', () => expect(bubbleRadius(80, true)).toBe(3.5))
})
