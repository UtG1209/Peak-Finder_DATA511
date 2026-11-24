import { describe, expect, it } from 'vitest'
import { saveWalkReturn, takeWalkReturn } from './walkReturn'

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }

describe('walk return', () => {
  it('gives the scroll back once, for the same hike', () => {
    const s = memory(); saveWalkReturn(s, 'a', 840, 1000)
    expect(takeWalkReturn(s, 'a', 2000)).toBe(840)
    expect(takeWalkReturn(s, 'a', 2000)).toBeNull()
  })
  it('ignores another hike and stale entries', () => {
    const s = memory(); saveWalkReturn(s, 'a', 840, 0)
    expect(takeWalkReturn(s, 'b', 1)).toBeNull()
    saveWalkReturn(s, 'a', 840, 0)
    expect(takeWalkReturn(s, 'a', 3 * 60 * 60 * 1000)).toBeNull()
  })
})
