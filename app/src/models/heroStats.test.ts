import { describe, expect, it } from 'vitest'
import { heroStats } from './heroStats'

describe('heroStats', () => {
  it('no limits: no match claim, the cheapest quarter', () => {
    const s = heroStats({ matches: [100, 100, 100, 100], costs: [1440, 1500, 1600, 1437], best: 4, anyLimit: false })
    expect(s.bestMatch).toBeNull()
    expect(s.tieNote).toMatch(/Set limits/)
    expect(s.trip).toEqual({ total: 1437, note: 'The cheapest quarter' })
  })
  it('a tie: names the other quarters and the cost tie-break', () => {
    const s = heroStats({ matches: [100, 100, 0, 100], costs: [1440, 1500, 1600, 1437], best: 4, anyLimit: true })
    expect(s.bestMatch).toBe(100)
    expect(s.tieNote).toBe('Q1 and Q2 also 100%')
    expect(s.trip?.note).toBe('$3 under Q1, the tie-break')
  })
  it('one winner: the runner-up; no city means no trip', () => {
    const s = heroStats({ matches: [40, 64, 0, 90], costs: [null, null, null, null], best: 4, anyLimit: true })
    expect(s.tieNote).toBe('Next best Q2, 64%')
    expect(s.trip).toBeNull()
  })
})
