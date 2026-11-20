import { describe, expect, it } from 'vitest'
import { flipDeltas } from './flip'

describe('flipDeltas', () => {
  it('returns old minus new for rows that moved', () => {
    const before = new Map([['a', 0], ['b', 60], ['c', 120]])
    const after = new Map([['b', 0], ['c', 60], ['a', 120]])
    const d = flipDeltas(before, after)
    expect(d.get('a')).toBe(-120) // moved down: starts 120 px above its new place
    expect(d.get('b')).toBe(60)
    expect(d.get('c')).toBe(60)
  })
  it('leaves out rows that did not move and rows missing on one side', () => {
    const before = new Map([['a', 0], ['b', 60]])
    const after = new Map([['a', 0], ['b', 60.4], ['c', 120]])
    expect(flipDeltas(before, after).size).toBe(0)
  })
  it('returns nothing for an unchanged order', () => {
    const m = new Map([['a', 0], ['b', 60]])
    expect(flipDeltas(m, m).size).toBe(0)
  })
})
