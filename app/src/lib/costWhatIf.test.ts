import { describe, expect, it } from 'vitest'
import { tripCost } from '../models/cost'
import { costSeaAngelsQ3 as row, travelSeaAngels as travel } from '../test/fixtures'
import { cheapestQuarter, costAnswer, lineName, whatIf } from './costWhatIf'

const p = { travellers: 1, nights: 2, mode: 'fly' as const }

describe('costAnswer', () => {
  const base = tripCost(row, p) // total 1,123.50, transport 519.56
  const dear = tripCost({ ...row, fare_one_way: 300 }, p)
  it('names the cheapest quarter and the biggest part with its lines', () => {
    const a = costAnswer([dear, base, null, dear], 2)!
    expect(a.title).toBe('About $1,124 in Q2, the cheapest quarter')
    expect(a.detail).toBe('Getting there is 46% of it: flights $340 and rental car $180.')
  })
  it('says how much more than the cheapest when another quarter is picked', () => {
    expect(costAnswer([dear, base, null, dear], 1)!.title).toMatch(/^About \$1,\d{3} in Q1, \$\d+ more than Q2$/)
    expect(costAnswer([dear, base, null, dear], 3)).toBeNull()
  })
  it('gives a one-line part its amount instead of a list', () => {
    const lodgingHeavy = tripCost({ ...row, lodging_per_night: 900 }, p)
    expect(costAnswer([lodgingHeavy, null, null, null], 1)!.detail).toMatch(/^Lodging is \d+% of it, \$[\d,]+\.$/)
  })
  it('finds no cheapest quarter without data', () => expect(cheapestQuarter([null, null, null, null])).toBeNull())
  it('drops the arithmetic from a line name', () => expect(lineName('Rental car ($60/day × 3 days, assumed)')).toBe('rental car'))
})

describe('whatIf', () => {
  it('prices one more night, driving instead and a second traveller', () => {
    const d = whatIf(row, p, travel)
    expect(d.map((x) => [x.label, x.value])).toEqual([['One more night', '+$289'], ['Drive instead', '$926'], ['Two travellers', '$1,709']])
    expect(d[1].note).toBe('$198 less, but 15.6 h each way instead of 6.4 h.')
    expect(d[2].note).toBe('$855 each: rooms and car are shared.')
  })
  it('offers flying when already driving, and drops deltas at the limits', () => {
    const d = whatIf(row, { travellers: 12, nights: 21, mode: 'drive' }, null)
    expect(d.map((x) => x.label)).toEqual(['Fly instead'])
    expect(d[0].note).toMatch(/more\.$/)
  })
})
