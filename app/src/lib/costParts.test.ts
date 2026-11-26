import { describe, expect, it } from 'vitest'
import { PART_CALLOUT, PART_DIRECT, PART_ORDER, PART_SHORT, calloutHeight, labelMode, quarterNote, quarterTags, spreadCallouts } from './costParts'

describe('labelMode', () => {
  it('fits name and amount only in tall segments', () => {
    expect(labelMode(60)).toBe('two')
    expect(labelMode(36)).toBe('two')
    expect(labelMode(35)).toBe('one')
    expect(labelMode(22)).toBe('one')
    expect(labelMode(21)).toBe('none')
    expect(labelMode(0)).toBe('none')
  })
})

describe('quarterTags', () => {
  it('tags cheapest and best, together when they coincide', () => {
    expect(quarterTags(2, 2, 3).map((t) => t.text)).toEqual(['Cheapest'])
    expect(quarterTags(3, 2, 3).map((t) => t.text)).toEqual(['Best fit'])
    expect(quarterTags(2, 2, 2).map((t) => t.text)).toEqual(['Cheapest', 'Best fit'])
    expect(quarterTags(1, 2, 3)).toEqual([])
    expect(quarterTags(1, null, null)).toEqual([])
  })
})

describe('quarterNote', () => {
  it('puts the tags in words under the quarter', () => {
    expect(quarterNote(4, 4, 4)).toBe('best and cheapest')
    expect(quarterNote(2, 2, 3)).toBe('cheapest')
    expect(quarterNote(3, 2, 3)).toBe('best fit')
    expect(quarterNote(1, 2, 3)).toBe('')
  })
})

describe('parts', () => {
  it('has a short name for every stacked part', () => {
    for (const p of PART_ORDER) expect(PART_SHORT[p] && PART_DIRECT[p]).toBeTruthy()
    expect(PART_ORDER[0]).toBe('transport')
    expect(PART_ORDER.at(-1)).toBe('buffer')
  })
})

describe('spreadCallouts', () => {
  const noOverlap = (m: Map<string, number>, hs: Record<string, number>, gap: number) => {
    const rows = [...m.entries()].map(([k, t]) => ({ t, b: t + hs[k] })).sort((a, b) => a.t - b.t)
    for (let i = 1; i < rows.length; i++) expect(rows[i].t).toBeGreaterThanOrEqual(rows[i - 1].b + gap - 1e-9)
  }
  it('centres a lone label on its slice', () => {
    const m = spreadCallouts([{ key: 'a', y: 100, h: 28 }], 4, 0, 300)
    expect(m.get('a')).toBe(86)
  })
  it('pushes labels apart when two slices are close', () => {
    const items = [{ key: 'a', y: 100, h: 42 }, { key: 'b', y: 108, h: 28 }]
    const m = spreadCallouts(items, 4, 0, 300)
    noOverlap(m, { a: 42, b: 28 }, 4)
    expect(m.get('a')).toBe(79) // keeps its own place, the next one moves down
    expect(m.get('b')).toBe(79 + 42 + 4)
  })
  it('stays inside the column at the top and the bottom edge', () => {
    const top = spreadCallouts([{ key: 'a', y: 2, h: 28 }], 4, 10, 300)
    expect(top.get('a')).toBe(10)
    const items = [{ key: 'a', y: 290, h: 42 }, { key: 'b', y: 295, h: 28 }]
    const m = spreadCallouts(items, 4, 0, 300)
    noOverlap(m, { a: 42, b: 28 }, 4)
    expect((m.get('b') ?? 0) + 28).toBeLessThanOrEqual(300)
    expect(m.get('a')).toBeGreaterThanOrEqual(0)
  })
  it('does not depend on the input order', () => {
    const a = spreadCallouts([{ key: 'x', y: 50, h: 28 }, { key: 'y', y: 52, h: 28 }], 4, 0, 200)
    const b = spreadCallouts([{ key: 'y', y: 52, h: 28 }, { key: 'x', y: 50, h: 28 }], 4, 0, 200)
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort())
  })
  it('names the thin fees slice in words and sizes its callout', () => {
    expect(PART_CALLOUT.activity.join(' ')).toBe('Fees and permits')
    expect(calloutHeight('activity')).toBe(42)
    expect(calloutHeight('food')).toBe(28)
  })
})
