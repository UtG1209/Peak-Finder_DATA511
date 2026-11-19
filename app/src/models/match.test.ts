import { describe, expect, it } from 'vitest'
import { angelsQ3, month, travelSeaAngels } from '../test/fixtures'
import { bestQuarter, computeMatch, crowdLevel, NO_LIMITS, quarterValues, TOLERANCE } from './match'

const q = (over: Partial<Parameters<typeof month>[0]>[]) => over.map((o, i) => month({ month: i + 1, ...o }))

describe('crowdLevel', () => {
  it('maps band edges to whole levels', () => {
    expect(crowdLevel(0)).toBe(0)
    expect(crowdLevel(0.4)).toBeCloseTo(1)
    expect(crowdLevel(0.7)).toBeCloseTo(2)
    expect(crowdLevel(1)).toBeCloseTo(3)
  })
})

describe('quarterValues', () => {
  it('averages monthly medians and sums day counts', () => {
    const v = quarterValues(angelsQ3)
    expect(v.temp).toBeCloseTo((100.1 + 97.9 + 88) / 3, 5)
    expect(v.smoky).toBeCloseTo(0.8, 5)
    expect(v.wet).toBeCloseTo(7.7, 5)
  })
})

describe('computeMatch', () => {
  it('Angels Landing Q3 with a 60-85°F limit: temperature scores ~0 and the dot goes grey', () => {
    const r = computeMatch(angelsQ3, null, { ...NO_LIMITS, temp: [60, 85] })
    const temp = r.factors.find((f) => f.key === 'temp')!
    expect(temp.value).toBeCloseTo(95.33, 1)
    expect(temp.distancePast).toBeGreaterThan(TOLERANCE.temp) // more than 10°F past the band
    expect(temp.score).toBe(0)
    expect(r.match).toBe(0)
    expect(r.greyed).toBe(true)
  })

  it('scores 100 and is not grey when every slider is on Any', () => {
    const r = computeMatch(angelsQ3, null, NO_LIMITS)
    expect(r.match).toBe(100)
    expect(r.greyed).toBe(false)
    expect(r.factors.every((f) => !f.active)).toBe(true)
  })

  it('scores 1 inside the band and falls linearly to 0 at the tolerance', () => {
    const base = q([{ tmax_p50: 70 }, { tmax_p50: 70 }, { tmax_p50: 70 }])
    expect(computeMatch(base, null, { ...NO_LIMITS, temp: [60, 80] }).match).toBe(100)
    expect(computeMatch(base, null, { ...NO_LIMITS, temp: [40, 65] }).match).toBeCloseTo(50) // 5°F past, tolerance 10
    expect(computeMatch(base, null, { ...NO_LIMITS, temp: [40, 60] }).match).toBe(0) // 10°F past
  })

  it('averages only the active factors', () => {
    // temp perfect (100), smoky 5 days over a limit of 0 -> 0 => mean 50
    const months = q([{ smoky_days: 2 }, { smoky_days: 2 }, { smoky_days: 1 }])
    const r = computeMatch(months, null, { ...NO_LIMITS, temp: [60, 90], smoky: 0 })
    expect(r.match).toBeCloseTo(50)
    expect(r.factors.filter((f) => f.active)).toHaveLength(2)
  })

  it('sums smoky and wet days over the quarter', () => {
    const months = q([{ wet_days: 4 }, { wet_days: 4 }, { wet_days: 4 }])
    // 12 wet days vs limit 7 -> 5 past, tolerance 10 -> 0.5
    expect(computeMatch(months, null, { ...NO_LIMITS, wet: 7 }).match).toBeCloseTo(50)
  })

  it('scores crowds by band steps: a Busy park under a Quiet limit is far past it', () => {
    const busy = q([{ crowd_level: 1 }, { crowd_level: 1 }, { crowd_level: 1 }])
    const r = computeMatch(busy, null, { ...NO_LIMITS, crowd: 0 })
    expect(r.match).toBe(0) // level 3 vs cap 1 = 2 levels past, tolerance 2
    const moderate = q([{ crowd_level: 0.7 }, { crowd_level: 0.7 }, { crowd_level: 0.7 }])
    expect(computeMatch(moderate, null, { ...NO_LIMITS, crowd: 0 }).match).toBeCloseTo(50) // 1 level past
    expect(computeMatch(moderate, null, { ...NO_LIMITS, crowd: 1 }).match).toBe(100)
  })

  it('uses the default mode for travel and ignores the limit when no city is chosen', () => {
    // Seattle -> Angels Landing: default mode "fly" = 6.4 h; limit 4 h -> 2.4 h past, tolerance 2 -> 0
    const r = computeMatch(angelsQ3, travelSeaAngels, { ...NO_LIMITS, travelHr: 4 })
    expect(r.factors.find((f) => f.key === 'travel')!.value).toBe(6.4)
    expect(r.match).toBe(0)
    const noCity = computeMatch(angelsQ3, null, { ...NO_LIMITS, travelHr: 4 })
    expect(noCity.match).toBe(100)
    expect(noCity.factors.find((f) => f.key === 'travel')!.active).toBe(false)
  })

  it('leaves out factors with missing data and lists them', () => {
    const months = q([{ tmax_p50: null, wet_days: null, missing: ['temp', 'wet'] }, { tmax_p50: null, wet_days: null, missing: ['temp', 'wet'] }, { tmax_p50: null, wet_days: null, missing: ['temp', 'wet'] }])
    const r = computeMatch(months, null, { ...NO_LIMITS, temp: [60, 80], wet: 5, smoky: 3 })
    expect(r.skipped.sort()).toEqual(['temp', 'wet'])
    expect(r.factors.filter((f) => f.active).map((f) => f.key)).toEqual(['smoky'])
    expect(r.match).toBe(100)
  })

  it('flags quarters with a closed month', () => {
    const months = q([{ closed: true }, { closed: false }, { closed: false }])
    expect(computeMatch(months, null, NO_LIMITS).hasClosedMonth).toBe(true)
  })
})

describe('bestQuarter', () => {
  it('picks the highest match', () => expect(bestQuarter([40, 90, 70, 60])).toBe(1))
  it('breaks a tie with the cheaper quarter', () => expect(bestQuarter([80, 80, 60, 50], [900, 700, 500, 500])).toBe(1))
  it('keeps the earlier quarter on a full tie without costs', () => expect(bestQuarter([80, 80, 80, 80])).toBe(0))
})
