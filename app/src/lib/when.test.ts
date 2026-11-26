import { describe, expect, it } from 'vitest'
import type { HikeMonth } from '../data/schema'
import { computeMatch, NO_LIMITS } from '../models/match'
import { hazardChips, monthWords, quarterWhy, whenAnswer } from './when'

const month = (m: number, over: Partial<HikeMonth> = {}): HikeMonth => ({
  hike_id: 'x', month: m, crowd_level: 0.5, crowd_band: 'moderate', tmax_p25: 60, tmax_p50: 67, tmax_p75: 72, tmax_summit_est: 60,
  wet_days: 2, snow_days: 0, smoky_days: 0, ozone_days: 0, heat_days: 0, daylight_hr: 11, sunrise: '07:00', sunset: '18:00', closed: false, missing: [], ...over,
})
const f = { temp: [55, 85] as [number, number], crowd: null, smoke: null, rain: null, units: 'us' as const }
const limits = { ...NO_LIMITS, temp: [55, 85] as [number, number] }
const year = Array.from({ length: 12 }, (_, i) => month(i + 1, i >= 6 && i <= 8 ? { tmax_p50: 97, heat_days: [20, 13, 1][i - 6] } : {}))
const quarters = [0, 1, 2, 3].map((q) => year.slice(q * 3, q * 3 + 3))
const matches = quarters.map((m) => computeMatch(m, null, limits))

describe('quarterWhy', () => {
  it('names the limiting factor with its typical value', () => {
    expect(quarterWhy(matches[2], quarters[2], f)).toMatchObject({ why: 'Too hot: 97°F, 12°F past your limit', clause: 'averages 97°F, 12°F past your 85°F limit' })
  })
  it('a quarter inside every limit reads as its typical high and crowds', () => {
    expect(quarterWhy(matches[3], quarters[3], f)).toMatchObject({ why: '67°F typical, moderate', clause: null, leftOut: null })
  })
  it('says which factor is left out for missing data', () => {
    const m = quarters[0].map((x) => ({ ...x, tmax_p50: null, missing: ['temp' as const] }))
    expect(quarterWhy(computeMatch(m, null, limits), m, f).leftOut).toBe('1 factor left out: temperature')
  })
})

describe('whenAnswer', () => {
  it('names the best season and the quarter that is out, with the reason', () => {
    const a = whenAnswer(matches, quarters, 4, f)
    expect(a.title).toBe('Autumn is the pick; summer is out')
    expect(a.answer).toBe('Q4 runs a typical 67°F with moderate crowds. Q3 averages 97°F, 12°F past your 85°F limit, so it scores 0%.')
  })
  it('without limits it says so', () => {
    const open = quarters.map((m) => computeMatch(m, null, NO_LIMITS))
    expect(whenAnswer(open, quarters, 1, { ...f, temp: null }).answer).toMatch(/not set any limits/)
  })
})

describe('hazardChips', () => {
  it('groups heat months into one chip in words', () => {
    expect(hazardChips(year, 'us')).toEqual([{ key: 'heat', months: [7, 8, 9], text: 'Heat: 20, 13 and 1 days at or above 100°F, Jul to Sep' }])
  })
  it('lists months that are not next to each other', () => {
    const y = year.map((m) => ({ ...m, heat_days: 0, smoky_days: m.month === 1 || m.month === 8 ? 2 : 0 }))
    expect(hazardChips(y, 'us')[0].text).toBe('Smoke: 2 and 2 smoky days, Jan and Aug')
  })
})

describe('monthWords', () => {
  it('spells out one month for the column button and tooltip', () => {
    expect(monthWords(month(10, { tmax_p25: 71, tmax_p50: 79, tmax_p75: 84, crowd_level: 0.76, wet_days: 2.4, daylight_hr: 11.3 }), 'us')).toEqual({
      high: 'High 79°F (71–84°F)', crowd: 'Crowds busy, 0.76 of the busiest month', days: '0 smoky, 2.4 wet days', light: '11.3 h daylight',
    })
    expect(monthWords(month(1, { tmax_p50: null, wet_days: null }), 'us')).toMatchObject({ high: 'No station within 50 km', days: '0 smoky days, no rain data' })
  })
})
