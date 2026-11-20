import { describe, expect, it } from 'vitest'
import type { FactorResult, MatchResult } from '../models/match'
import { angelsQ3 } from '../test/fixtures'
import { reasonRows } from './reasons'

const factor = (key: FactorResult['key'], over: Partial<FactorResult>): FactorResult => ({
  key, value: 1, limit: null, distancePast: 0, tolerance: 5, score: 1, active: true, ...over,
})
const result = (smoky: Partial<FactorResult>): MatchResult => ({
  match: 90,
  greyed: false,
  skipped: [],
  hasClosedMonth: false,
  factors: [factor('temp', {}), factor('crowd', {}), factor('smoky', smoky), factor('wet', {}), factor('travel', {})],
})
const smokyNote = (r: MatchResult) => reasonRows(r, angelsQ3).find((x) => x.key === 'smoky')!

describe('reasonRows overage wording', () => {
  it('says "Just over" when a fractional overage rounds to zero', () => {
    const row = smokyNote(result({ distancePast: 0.4 }))
    expect(row.note).toBe('Just over')
    expect(row.warn).toBe(true)
  })
  it('keeps the number when the overage is visible', () => {
    expect(smokyNote(result({ distancePast: 3 })).note).toBe('Over by 3 days')
  })
  it('is OK inside the limit', () => {
    const row = smokyNote(result({ distancePast: 0 }))
    expect(row.note).toBe('OK')
    expect(row.warn).toBe(false)
  })
})
