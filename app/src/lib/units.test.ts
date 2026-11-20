import { describe, expect, it } from 'vitest'
import { fmtLength, fmtTemp, fmtTempDelta, fmtTempRange, spokenTemp } from './units'

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
