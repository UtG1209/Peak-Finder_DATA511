import { describe, expect, it } from 'vitest'
import { walkUrl } from './walks'

const hike = { id: 'angels-landing', name: 'Angels Landing', walk_path: 'walks/angels_landing/' }

describe('walk URLs', () => {
  it('keeps the season and encodes the hike return route and name', () => {
    const hash = '#/hike/angels-landing?from=SEA&q=3&temp=55-80'
    const url = walkUrl(hike, 'summer', hash)!
    const parsed = new URL(url, 'https://example.test')
    expect(parsed.searchParams.get('season')).toBe('summer')
    expect(parsed.searchParams.get('back')).toBe(hash)
    expect(parsed.searchParams.get('backname')).toBe('Angels Landing')
  })

  it('preserves checkpoint times on the walk link', () => {
    const url = walkUrl(hike, 'winter', {
      back: '#/hike/angels-landing?q=1',
      times: [{ dist_m: 1200, dir: 'up', time: 480 }, { dist_m: 1200, dir: 'down', time: 650 }],
    })!
    const parsed = new URL(url, 'https://example.test')
    expect(JSON.parse(parsed.searchParams.get('times')!)).toEqual([
      { dist_m: 1200, dir: 'up', time: 480 }, { dist_m: 1200, dir: 'down', time: 650 },
    ])
  })

  it('falls back to the hike route when the current hash is not a route', () => {
    const parsed = new URL(walkUrl(hike, 'winter', '')!, 'https://example.test')
    expect(parsed.searchParams.get('back')).toBe('#/hike/angels-landing')
  })

  it('returns null when a hike has no 3D walk', () => {
    expect(walkUrl({ ...hike, walk_path: null }, 'summer')).toBeNull()
  })
})
