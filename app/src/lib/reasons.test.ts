import { describe, expect, it } from 'vitest'
import type { HikeMonth } from '../data/schema'
import { computeMatch, NO_LIMITS } from '../models/match'
import { reasonRows } from './reasons'

const month = (over: Partial<HikeMonth> = {}): HikeMonth => ({
  hike_id: 'x', month: 7, crowd_level: 0.5, crowd_band: 'moderate', tmax_p25: 70, tmax_p50: 75, tmax_p75: 80, tmax_summit_est: 70,
  wet_days: 2, snow_days: 0, smoky_days: 1, ozone_days: 0, heat_days: 0, daylight_hr: 14, sunrise: '06:00', sunset: '20:00', closed: false, missing: [], ...over,
})

describe('reasonRows with missing data', () => {
  const noStation = [7, 8, 9].map((m) => month({ month: m, tmax_p50: null, tmax_p25: null, tmax_p75: null, wet_days: null, missing: ['temp', 'wet'] }))
  it('says "No station within 50 km" for temperature and rain, even with no limit set', () => {
    const rows = reasonRows(computeMatch(noStation, null, NO_LIMITS), noStation)
    for (const key of ['temp', 'wet']) {
      const r = rows.find((x) => x.key === key)!
      expect(r.note).toBe('No station within 50 km')
      expect(r.missing).toBe(true)
      expect(r.warn).toBe(false)
    }
  })
  it('does not flag complete data as missing', () => {
    const full = [7, 8, 9].map((m) => month({ month: m }))
    expect(reasonRows(computeMatch(full, null, NO_LIMITS), full).some((r) => r.missing)).toBe(false)
  })
})

describe('reasonRows units', () => {
  const hot = [7, 8, 9].map((m) => month({ month: m, tmax_p50: 95 }))
  const result = computeMatch(hot, null, { ...NO_LIMITS, temp: [60, 85] })
  it('shows °F by default and °C when metric', () => {
    expect(reasonRows(result, hot).find((r) => r.key === 'temp')).toMatchObject({ value: '95°F', note: 'Over by 10°F', warn: true })
    expect(reasonRows(result, hot, 'metric').find((r) => r.key === 'temp')).toMatchObject({ value: '35°C', note: 'Over by 6°C', warn: true })
  })
})
