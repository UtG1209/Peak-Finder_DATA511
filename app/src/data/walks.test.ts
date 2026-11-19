// Integration tests for the 3D walks: walks/manifest.json is the single source of truth, and the app data, the walk folders and the
// hike links must all agree. Mirrors pipeline/walks/build_walk.py (which runs the same checks while building a walk).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HikeSchema, ProfileSchema } from './schema'

const root = join(__dirname, '../../..')
const manifest = JSON.parse(readFileSync(join(root, 'walks/manifest.json'), 'utf8')) as {
  size_budget_mb: number
  walks: Record<string, { hike_id: string; kit_trail: string; legacy?: boolean }>
}
const hikes = HikeSchema.array().parse(JSON.parse(readFileSync(join(root, 'app/public/data/hikes.json'), 'utf8')))

const dirSize = (d: string): number =>
  readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(join(d, e.name)) : statSync(join(d, e.name)).size), 0)

describe('walks manifest and app data agree', () => {
  it('every manifest walk has a folder, an index.html and a hike that links to it', () => {
    for (const [id, w] of Object.entries(manifest.walks)) {
      expect(existsSync(join(root, 'walks', id, 'index.html')), `${id}/index.html`).toBe(true)
      const hike = hikes.find((h) => h.id === w.hike_id)
      expect(hike, `hike ${w.hike_id}`).toBeTruthy()
      expect(hike!.featured).toBe(true)
      expect(hike!.walk_path).toBe(`walks/${id}/`)
    }
  })

  it('every featured hike has a walk in the manifest (no dangling 3D buttons)', () => {
    for (const h of hikes.filter((x) => x.featured)) {
      const id = h.walk_path?.split('/')[1] ?? ''
      expect(manifest.walks[id], `${h.id} -> ${h.walk_path}`).toBeTruthy()
      expect(manifest.walks[id].hike_id).toBe(h.id)
    }
    for (const h of hikes.filter((x) => !x.featured)) expect(h.walk_path).toBeNull()
  })

  it('every kit config named in the manifest exists', () => {
    for (const w of Object.values(manifest.walks)) expect(existsSync(join(root, 'pipeline/trail_kit/trails', `${w.kit_trail}.json`)), w.kit_trail).toBe(true)
  })
})

describe('each walk is complete, credited and within budget', () => {
  for (const [id, w] of Object.entries(manifest.walks)) {
    const dir = join(root, 'walks', id)
    const html = readFileSync(join(dir, 'index.html'), 'utf8')

    it(`${id}: every photo and cloud file the page names exists (clouds may be in walks/_shared)`, () => {
      const files = [...new Set(html.match(/(?:\.\.\/_shared\/)?(?:photos|clouds)\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)/g) ?? [])]
      expect(files.length).toBeGreaterThan(3)
      for (const f of files) expect(existsSync(join(dir, f)), f).toBe(true)
    })

    it(`${id}: credits, the illustrative note and all four seasons are on the page`, () => {
      for (const needle of ['USGS', 'OpenStreetMap', 'Commons', 'illustrative', 'URLSearchParams']) expect(html, needle).toContain(needle)
      expect(html.includes('Terrain Tiles') || html.includes('Mapzen')).toBe(true)
      for (const s of ['Spring', 'Summer', 'Autumn', 'Winter']) expect(html, s).toContain(s)
    })

    it(`${id}: the embedded route matches the hike page profile`, () => {
      const m = html.match(/const PROFILE\s*=\s*(\[\[[\s\S]*?\]\]);/)
      expect(m, 'const PROFILE').toBeTruthy()
      const profile = JSON.parse(m![1]) as number[][]
      expect(profile.length).toBeGreaterThan(50)
      const hp = join(root, 'app/public/data/profiles', `${w.hike_id}.json`)
      const p = ProfileSchema.parse(JSON.parse(readFileSync(hp, 'utf8')))
      expect(p.osm_length_m).toBe(Math.round(profile.at(-1)![2])) // same route length as the walk
      expect(p.points.length).toBe(profile.length)
    })

    it(`${id}: size is within the budget (legacy walks are exempt)`, () => {
      const mb = dirSize(dir) / 1024 / 1024
      if (!w.legacy) expect(mb).toBeLessThanOrEqual(manifest.size_budget_mb)
      else expect(mb).toBeLessThan(60) // legacy walks must not grow either
    })
  }
})
