import { describe, expect, it } from 'vitest'
import { comparableBars, fmtAdviceNumber } from './adviceBars'

describe('comparableBars', () => {
  it('two shares or two counts are comparable', () => {
    expect(comparableBars({ 2010: 0.446, 2023: 0.766 })).toHaveLength(2)
    expect(comparableBars({ 'June 2023': 564036, 'Year 2023': 4623238 })).toHaveLength(2)
    expect(comparableBars({ 'AQI>100 days': 71, 'PM2.5 (smoke) days': 33, 'Ozone days': 38 })).toHaveLength(3)
  })
  it('different units, a single value or mixed kinds are not', () => {
    expect(comparableBars({ 'Station mean Aug high (F)': 97.9, 'Days >= 100 F per August': 13 })).toBeNull()
    expect(comparableBars({ 'Q3 2025 average one-way fare ($)': 169.78 })).toBeNull()
    expect(comparableBars({ a: 0.5, b: 30 })).toBeNull()
  })
  it('formats shares and counts', () => {
    expect(fmtAdviceNumber(0.446)).toBe('44.6%')
    expect(fmtAdviceNumber(564036)).toBe('564,036')
  })
})
