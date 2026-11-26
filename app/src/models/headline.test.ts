import { describe, expect, it } from 'vitest'
import { headline, type HeadlineInput } from './headline'

const base: HeadlineInput = { matches: [58, 74, 31, 91], costs: [1441, 1564, 1487, 1437], best: 4, anyLimit: true, high: '67°F', smoky: 0, city: 'Seattle' }

describe('headline', () => {
  it('one winner: the score, the typical high, smoke and cost', () => {
    expect(headline(base)).toBe('Q4 fits 91%: typical high 67°F, no smoky days, about $1,437 from Seattle.')
  })
  it('a tie at 100 says "fit your limits", never "fits 100%", and names the cheapest', () => {
    const t = headline({ ...base, matches: [100, 100, 0, 100] })
    expect(t).toBe('Q1, Q2 and Q4 fit your limits. Q4 is the cheapest of them, at about $1,437 from Seattle.')
    expect(t).not.toMatch(/100%/)
  })
  it('a tie keeps the price when the best of the TIED quarters is not the cheapest overall', () => {
    const t = headline({ ...base, matches: [0, 100, 100, 0], costs: [900, 1500, 1600, 800], best: 2 })
    expect(t).toBe('Q2 and Q3 fit your limits. Q2 is the cheapest of them, at about $1,500 from Seattle.')
  })
  it('a tie below 100 shows the score', () => {
    expect(headline({ ...base, matches: [80, 80, 10, 80], best: 1 })).toMatch(/^Q1, Q2 and Q4 fit equally well \(80%\)\./)
  })
  it('no limits set: the typical year, no percent', () => {
    const t = headline({ ...base, anyLimit: false, matches: [100, 100, 100, 100] })
    expect(t).toBe('No limits set. Here is the typical year: Q4 is the cheapest, about $1,437 from Seattle.')
  })
  it('no limits and no home city: asks for limits', () => {
    expect(headline({ ...base, anyLimit: false, costs: [null, null, null, null] })).toBe('No limits set. Set your limits to see which quarter fits you.')
  })
  it('missing pieces are left out, not invented', () => {
    expect(headline({ ...base, high: null, smoky: null, costs: [null, null, null, null] })).toBe('Q4 fits 91%.')
    expect(headline({ ...base, smoky: 1, city: null })).toBe('Q4 fits 91%: typical high 67°F, 1 smoky day, about $1,437.')
  })
})
