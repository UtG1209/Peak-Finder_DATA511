import { describe, expect, it } from 'vitest'
import { distFromM, elevFromM, fmtDist, fmtElev, fmtLength, fmtTemp, fmtTempDelta, fmtTempRange, spokenTemp } from './units'

describe('units', () => {
  it('US units are the data as it is', () => {
    expect(fmtTemp(68, 'us')).toBe('68°F')
    expect(fmtLength(5.4, 'us')).toBe('5.4 mi')
    expect(fmtTempRange(55, 80, 'us')).toBe('55–80°F')
  })
  it('converts to °C and km', () => {
    expect(fmtTemp(68, 'metric')).toBe('20°C')
    expect(fmtTemp(32, 'metric')).toBe('0°C')
    expect(fmtLength(5.4, 'metric')).toBe('8.7 km')
    expect(fmtTempRange(50, 86, 'metric')).toBe('10–30°C')
  })
  it('a temperature difference has no 32° offset', () => {
    expect(fmtTempDelta(18, 'metric')).toBe('10°C')
    expect(fmtTempDelta(18, 'us')).toBe('18°F')
  })
  it('speaks the unit for screen readers', () => {
    expect(spokenTemp(68, 'us')).toBe('68 degrees Fahrenheit')
    expect(spokenTemp(68, 'metric')).toBe('20 degrees Celsius')
  })
})

describe('elevation and distance', () => {
  it('formats feet and metres', () => {
    expect(fmtElev(5790, 'us')).toBe('5,790 ft')
    expect(fmtElev(5790, 'metric')).toBe('1,765 m')
  })
  it('formats metres of trail as miles or km', () => {
    expect(fmtDist(4345, 'metric')).toBe('4.3 km')
    expect(fmtDist(4345, 'us')).toBe('2.7 mi')
  })
  it('axis conversions', () => {
    expect(elevFromM(1000, 'metric')).toBe(1000)
    expect(elevFromM(304.8, 'us')).toBeCloseTo(1000)
    expect(distFromM(1609.344, 'us')).toBeCloseTo(1)
    expect(distFromM(2500, 'metric')).toBe(2.5)
  })
})

