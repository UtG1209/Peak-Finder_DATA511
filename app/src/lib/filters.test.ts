import { describe, expect, it } from 'vitest'
import { defaultFilters, parseFilters, serializeFilters, toLimits } from './filters'
import { defaultQuarter } from './quarters'

const params = (s: string) => new URLSearchParams(s)

describe('URL filter state', () => {
  it('parses the CLAUDE.md example URL', () => {
    const f = parseFilters(params('from=SEA&q=3&temp=55-80&crowd=2&smoke=3&rain=10&travel=8&diff=easy,moderate&3d=1'))
    expect(f).toEqual({ from: 'SEA', q: 3, temp: [55, 80], crowd: 2, smoke: 3, rain: 10, travel: 8, diff: ['easy', 'moderate'], has3d: true })
  })

  it('round-trips through serialize', () => {
    const f = parseFilters(params('from=DEN&q=1&temp=40-70&crowd=0&smoke=2'))
    expect(parseFilters(serializeFilters(f))).toEqual(f)
  })

  it('an empty URL means everything wide open', () => {
    const f = parseFilters(params(''), new Date(2026, 10, 18))
    expect(f).toMatchObject({ from: null, temp: null, crowd: null, smoke: null, rain: null, travel: null, diff: [], has3d: false })
    expect(f.q).toBe(1) // November is Q4, so the next quarter is Q1
  })

  it('ignores junk values', () => {
    const f = parseFilters(params('from=XXX&q=9&temp=hot&crowd=7&diff=extreme,easy'), new Date(2026, 0, 5))
    expect(f.from).toBeNull()
    expect(f.q).toBe(2)
    expect(f.temp).toBeNull()
    expect(f.crowd).toBeNull()
    expect(f.diff).toEqual(['easy'])
  })

  it('rejects an inverted temperature band', () => expect(parseFilters(params('temp=80-60')).temp).toBeNull())

  it('travel only counts when a home city is chosen', () => {
    expect(toLimits({ ...defaultFilters(), travel: 6 }).travelHr).toBeNull()
    expect(toLimits({ ...defaultFilters(), from: 'SEA', travel: 6 }).travelHr).toBe(6)
  })
})

describe('defaultQuarter', () => {
  it('is the next quarter, wrapping Q4 to Q1', () => {
    expect(defaultQuarter(new Date(2026, 1, 1))).toBe(2)
    expect(defaultQuarter(new Date(2026, 5, 30))).toBe(3)
    expect(defaultQuarter(new Date(2026, 11, 31))).toBe(1)
  })
})
