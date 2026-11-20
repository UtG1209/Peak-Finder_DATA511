import { describe, expect, it } from 'vitest'
import { walkUrl } from './walks'

const hike = { id: 'angels-landing', name: "Angels Landing & Co", walk_path: 'walks/angels_landing/' }

describe('walkUrl', () => {
  it('keeps the season and encodes back and backname', () => {
    const hash = '#/hike/angels-landing?from=SEA&q=3&temp=55-80'
    const u = walkUrl(hike, 'summer', hash)!
    const params = new URL(u, 'http://x/').searchParams
    expect(u).toContain('walks/angels_landing/index.html?season=summer')
    expect(u).toContain(`back=${encodeURIComponent(hash)}`)
    expect(params.get('back')).toBe(hash)
    expect(params.get('backname')).toBe('Angels Landing & Co')
    expect(params.get('season')).toBe('summer')
  })
  it('falls back to the plain hike address when the hash is not a route', () => {
    const params = new URL(walkUrl(hike, 'winter', '')!, 'http://x/').searchParams
    expect(params.get('back')).toBe('#/hike/angels-landing')
  })
  it('returns null when the hike has no walk', () => {
    expect(walkUrl({ ...hike, walk_path: null }, 'summer', '#/hike/x')).toBeNull()
  })
})
