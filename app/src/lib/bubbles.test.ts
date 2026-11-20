import { describe, expect, it } from 'vitest'
import { bubbleRadius, separate } from './bubbles'

describe('bubbleRadius', () => {
  it('makes AREA proportional to match', () => {
    const area = (m: number) => Math.PI * bubbleRadius(m, false) ** 2
    expect(area(100) / area(64)).toBeCloseTo(100 / 64, 5)
  })
  it('never lets a fitting bubble vanish', () => expect(bubbleRadius(0.5, false)).toBeGreaterThanOrEqual(4))
  it('draws a failing hike as a small fixed dot', () => expect(bubbleRadius(80, true)).toBe(3.5))
})

describe('separate', () => {
  const dist = (a: { x: number; y: number }, o: Map<string, [number, number]>, id: string) => ({ x: a.x + (o.get(id)?.[0] ?? 0), y: a.y + (o.get(id)?.[1] ?? 0) })
  it('leaves far-apart peaks alone', () => {
    expect(separate([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }]).size).toBe(0)
  })
  it('pushes two close peaks apart, never more than maxShift, and moves them away from each other', () => {
    const a = { id: 'a', x: 50, y: 50 }
    const b = { id: 'b', x: 54, y: 50 }
    const o = separate([a, b], 14, 9)
    const pa = dist(a, o, 'a')
    const pb = dist(b, o, 'b')
    expect(pb.x - pa.x).toBeGreaterThan(b.x - a.x)
    expect(Math.hypot(...(o.get('a') ?? [0, 0]))).toBeLessThanOrEqual(9.001)
  })
  it('splits exactly coincident peaks and is deterministic regardless of input order', () => {
    const pts = [{ id: 'z', x: 10, y: 10 }, { id: 'a', x: 10, y: 10 }]
    const o1 = separate(pts)
    const o2 = separate([...pts].reverse())
    expect(o1.size).toBe(2)
    expect([...o1.entries()]).toEqual([...o2.entries()])
  })
})
