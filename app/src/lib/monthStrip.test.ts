import { describe, expect, it } from 'vitest'
import type { HikeMonth } from '../data/schema'
import { stripColumns } from './monthStrip'

const month = (m: number, over: Partial<HikeMonth> = {}): HikeMonth => ({
  hike_id: 'x', month: m, crowd_level: 0.5, crowd_band: 'moderate', tmax_p25: 60, tmax_p50: 70, tmax_p75: 80, tmax_summit_est: 66,
  wet_days: 3, snow_days: 0, smoky_days: 0, ozone_days: 0, heat_days: 0, daylight_hr: 12, sunrise: '06:30', sunset: '18:30', closed: false, missing: [], ...over,
})
const year = (over: (m: number) => Partial<HikeMonth> = () => ({})) => Array.from({ length: 12 }, (_, i) => month(i + 1, over(i + 1)))
const open = { temp: null, crowd: null, smoke: null, rain: null, q: 3 as const, units: 'us' as const }

describe('stripColumns', () => {
  it('has 12 columns in month order, even if the months arrive shuffled', () => {
    const cols = stripColumns([...year()].reverse(), open, 'us')
    expect(cols.map((c) => c.name)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
  })

  it('frames exactly the chosen quarter\'s three months', () => {
    const cols = stripColumns(year(), { ...open, q: 3 }, 'us')
    expect(cols.filter((c) => c.inChosenQuarter).map((c) => c.name)).toEqual(['Jul', 'Aug', 'Sep'])
    expect(cols.filter((c) => c.firstOfQuarter).map((c) => c.name)).toEqual(['Jan', 'Apr', 'Jul', 'Oct'])
    expect(cols.filter((c) => c.lastOfQuarter).map((c) => c.name)).toEqual(['Mar', 'Jun', 'Sep', 'Dec'])
  })

  it('with every limit open nothing is marked past', () => {
    const cols = stripColumns(year(), open, 'us')
    for (const c of cols) for (const cell of [c.temp, c.crowd, c.smoky, c.wet]) expect(cell.state).toBe('none')
  })

  it('marks a month outside the temperature band, in words', () => {
    const cols = stripColumns(year((m) => ({ tmax_p50: m === 7 ? 99 : 70 })), { ...open, temp: [60, 85] }, 'us')
    expect(cols[6].temp).toMatchObject({ text: '99°F', state: 'past', note: 'Outside your temperature range' })
    expect(cols[5].temp.state).toBe('ok')
  })

  it('marks busy months against the crowd limit', () => {
    const cols = stripColumns(year((m) => ({ crowd_level: m === 8 ? 0.95 : 0.2 })), { ...open, crowd: 1 }, 'us')
    expect(cols[7].crowd).toMatchObject({ text: 'Busy', state: 'past' })
    expect(cols[6].crowd).toMatchObject({ text: 'Quiet', state: 'ok' })
  })

  it('quarter day limits: a month is marked when it alone is above a third of the limit', () => {
    const cols = stripColumns(year((m) => ({ smoky_days: m === 8 ? 4 : 0.2, wet_days: m === 8 ? 12 : 2 })), { ...open, smoke: 6, rain: 15 }, 'us')
    expect(cols[7].smoky.state).toBe('past') // 4 > 6 / 3
    expect(cols[6].smoky.state).toBe('ok')
    expect(cols[7].wet.state).toBe('past') // 12 > 15 / 3
    expect(cols[6].wet.state).toBe('ok')
  })

  it('no station: grey cells that say why, and they are never marked past', () => {
    const cols = stripColumns(year(() => ({ tmax_p50: null, tmax_p25: null, tmax_p75: null, wet_days: null, heat_days: null, snow_days: null, missing: ['temp', 'wet'] })), { ...open, temp: [60, 85], rain: 5 }, 'us')
    expect(cols[0].temp).toMatchObject({ state: 'missing', note: 'No station within 50 km' })
    expect(cols[0].wet).toMatchObject({ state: 'missing', note: 'No station within 50 km' })
    expect(cols[0].hazards).toEqual([])
  })

  it('hazard row: heat, smoke, snow and closures, each in words', () => {
    const cols = stripColumns(year((m) => (m === 8 ? { heat_days: 13, smoky_days: 2, snow_days: 1, closed: true } : {})), open, 'us')
    expect(cols[7].hazards.map((h) => h.key)).toEqual(['closed', 'heat', 'smoke', 'snow'])
    expect(cols[7].hazards.find((h) => h.key === 'heat')!.text).toBe('Heat 13 days')
    expect(cols[0].hazards).toEqual([])
  })

  it('metric temperatures', () => {
    expect(stripColumns(year(), open, 'metric')[0].temp.text).toBe('21°C')
  })
})
