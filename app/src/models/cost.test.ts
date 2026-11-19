import { describe, expect, it } from 'vitest'
import { costSeaAngelsQ3 } from '../test/fixtures'
import { tripCost } from './cost'

describe('tripCost', () => {
  it('Angels Landing from Seattle, Q3, 2 people, 3 nights, flying', () => {
    const c = tripCost(costSeaAngelsQ3, { travellers: 2, nights: 3, mode: 'fly' })
    expect(c.transport).toBeCloseTo(169.78 * 2 * 2 + 60 * 4, 2) // 919.12
    expect(c.lodging).toBeCloseTo(110 * 3 * 1 * 1.12, 2) // 369.60, one room
    expect(c.food).toBeCloseTo(68 * 3.5 * 2, 2) // 476
    expect(c.activity).toBeCloseTo(35 + 6, 2) // entry + permit
    const subtotal = c.transport + c.lodging + c.food + c.activity
    expect(c.buffer).toBeCloseTo(subtotal * 0.15, 6)
    expect(c.total).toBeCloseTo(subtotal * 1.15, 6)
    expect(c.total).toBeCloseTo(2076.58, 1) // (679.12 + 240 + 369.60 + 476 + 41) x 1.15
  })

  it('driving uses gas for the round trip and one vehicle per 4 people', () => {
    const c = tripCost(costSeaAngelsQ3, { travellers: 5, nights: 2, mode: 'drive' })
    expect(c.transport).toBeCloseTo(((1060 * 2) / 25) * 4.1 * 2, 2) // 2 vehicles
    expect(c.lodging).toBeCloseTo(110 * 2 * 3 * 1.12, 2) // 3 rooms for 5
  })

  it('caps the entry fee at the $80 annual pass', () => {
    const row = { ...costSeaAngelsQ3, entry_fee_vehicle: 35 }
    // 9 travellers -> 3 vehicles x $35 = $105, capped at $80
    expect(tripCost(row, { travellers: 9, nights: 1, mode: 'fly' }).activity).toBeCloseTo(80 + 6, 2)
  })

  it('exposes line items for the popover', () => {
    const c = tripCost(costSeaAngelsQ3, { travellers: 1, nights: 1, mode: 'fly' })
    expect(c.lines.transport.map((l) => l.source)).toEqual(['fare', 'assumed'])
    expect(c.lines.activity.map((l) => l.source)).toEqual(['fees', 'fees'])
  })

  it('zero nights still prices half a day of food and one car day', () => {
    const c = tripCost(costSeaAngelsQ3, { travellers: 1, nights: 0, mode: 'fly' })
    expect(c.lodging).toBe(0)
    expect(c.food).toBeCloseTo(68 * 0.5, 2)
    expect(c.transport).toBeCloseTo(169.78 * 2 + 60, 2)
  })
})
