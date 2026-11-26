import { describe, expect, it } from 'vitest'
import { stepMonth } from './stepMonth'

describe('stepMonth', () => {
  const q4 = [10, 11, 12]
  it('walks whole quarter -> months -> whole quarter', () => {
    expect(stepMonth(q4, null, 1)).toBe(10)
    expect(stepMonth(q4, 12, 1)).toBeNull()
    expect(stepMonth(q4, null, -1)).toBe(12)
    expect(stepMonth(q4, 10, -1)).toBeNull()
  })
  it('a month from another quarter restarts at the whole quarter', () => {
    expect(stepMonth(q4, 3, 1)).toBe(10)
  })
})
