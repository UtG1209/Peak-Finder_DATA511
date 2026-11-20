import { describe, expect, it } from 'vitest'
import type { HikeMonth } from '../data/schema'
import { computeMatch, NO_LIMITS } from '../models/match'
import { fitRows } from './fit'

const month = (over: Partial<HikeMonth> = {}): HikeMonth => ({
  hike_id: 'x', month: 7, crowd_level: 0.5, crowd_band: 'moderate', tmax_p25: 70, tmax_p50: 95, tmax_p75: 100, tmax_summit_est: 90,
  wet_days: 2, snow_days: 0, smoky_days: 1, ozone_days: 0, heat_days: 0, daylight_hr: 14, sunrise: '06:00', sunset: '20:00', closed: false, missing: [], ...over,
})
const three = (over: Partial<HikeMonth> = {}) => [7, 8, 9].map((m) => month({ month: m, ...over }))
const f = { temp: null, crowd: null, smoke: null, rain: null, travel: null, from: null, units: 'us' } as const

describe('fitRows', () => {
  it('one row per factor, always five, with "Pick a home city" when there is no city', () => {
    const m = three()
    const rows = fitRows(computeMatch(m, null, NO_LIMITS), m, f)
    expect(rows.map((r) => r.key)).toEqual(['temp', 'smoky', 'crowd', 'wet', 'travel'])
    expect(rows.find((r) => r.key === 'travel')).toMatchObject({ note: 'Pick a home city', state: 'nolimit' })
    expect(rows.every((r) => r.score === null)).toBe(true) // no limits, so nothing is counted
  })

  it('a value past the limit says by how much, in words, with a partial score', () => {
    const m = three()
    const filters = { ...f, temp: [60, 85] as [number, number] }
    const row = fitRows(computeMatch(m, null, { ...NO_LIMITS, temp: [60, 85] }), m, filters).find((r) => r.key === 'temp')!
    expect(row).toMatchObject({ value: '95°F', limit: '60–85°F', note: 'Over by 10°F', state: 'past', score: 0 })
  })

  it('a value inside the limit scores 100', () => {
    const m = three()
    const filters = { ...f, temp: [80, 100] as [number, number] }
    const row = fitRows(computeMatch(m, null, { ...NO_LIMITS, temp: [80, 100] }), m, filters).find((r) => r.key === 'temp')!
    expect(row).toMatchObject({ state: 'ok', note: 'In range', score: 100 })
  })

  it('missing weather data is a grey row that says why and is left out', () => {
    const m = three({ tmax_p50: null, tmax_p25: null, tmax_p75: null, wet_days: null, missing: ['temp', 'wet'] })
    const rows = fitRows(computeMatch(m, null, { ...NO_LIMITS, temp: [60, 85] }), m, { ...f, temp: [60, 85] })
    for (const k of ['temp', 'wet']) expect(rows.find((r) => r.key === k)).toMatchObject({ state: 'missing', note: 'No station within 50 km', score: null })
  })

  it('metric words for the limit and the value', () => {
    const m = three()
    const row = fitRows(computeMatch(m, null, { ...NO_LIMITS, temp: [60, 85] }), m, { ...f, temp: [60, 85], units: 'metric' }).find((r) => r.key === 'temp')!
    expect(row.limit).toBe('16–29°C')
    expect(row.value).toBe('35°C')
  })

  it('crowd and day limits read as words', () => {
    const m = three()
    const filters = { ...f, crowd: 1 as const, smoke: 3, rain: 8 }
    const rows = fitRows(computeMatch(m, null, { ...NO_LIMITS, crowd: 1, smoky: 3, wet: 8 }), m, filters)
    expect(rows.find((r) => r.key === 'crowd')!.limit).toBe('Moderate')
    expect(rows.find((r) => r.key === 'smoky')!.limit).toBe('up to 3 days')
    expect(rows.find((r) => r.key === 'wet')!.limit).toBe('up to 8 days')
  })
})
