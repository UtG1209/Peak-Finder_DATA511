import { describe, expect, it } from 'vitest'
import type { Hike, HikeMonth } from '../data/schema'
import { findTwins } from './twins'

const hike = (id: string, park: string, length_mi: number, gain_ft: number, max_elev_ft: number) => ({ id, park_code: park, length_mi, gain_ft, max_elev_ft }) as Hike
const year = (id: string, high: number | null): HikeMonth[] =>
  Array.from({ length: 12 }, (_, i) => ({ hike_id: id, month: i + 1, tmax_p50: high == null ? null : high + i }) as HikeMonth)

const hikes = [hike('a', 'P1', 5, 1000, 5000), hike('b', 'P1', 5.1, 1010, 5050), hike('c', 'P1', 5.2, 1020, 5100), hike('d', 'P1', 5.3, 1030, 5150), hike('e', 'P2', 9, 3000, 9000)]
const months = new Map(hikes.map((h) => [h.id, year(h.id, h.id === 'e' ? 40 : 60)]))

describe('findTwins', () => {
  it('returns the nearest hikes first, never itself, and swaps in another park when the nearest are all one park', () => {
    const t = findTwins('a', hikes, months)
    expect(t.map((x) => x.id)).toEqual(['b', 'c', 'e'])
    expect(findTwins('a', hikes, months, 2).map((x) => x.id)).toEqual(['b', 'e'])
  })
  it('does not break on a hike with no monthly data', () => {
    const m = new Map(months); m.set('b', year('b', null))
    const t = findTwins('a', hikes, m)
    expect(t.every((x) => Number.isFinite(x.distance))).toBe(true)
  })
  it('names two factors and handles an unknown id', () => {
    expect(findTwins('a', hikes, months)[0].why).toHaveLength(2)
    expect(findTwins('zzz', hikes, months)).toEqual([])
  })
})
