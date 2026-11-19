// The data contract test. Run it on any data you produce: `npm run validate:data`.
// It reads app/public/data/*.json from disk and checks every file against the schemas, plus
// the cross-file rules from CLAUDE.md section 4. The fake data and the real pipeline output must both pass.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AdviceSchema, CostSchema, HikeMonthSchema, HikeSchema, MetaSchema, ProfileSchema, TravelSchema } from './schema'
import { CITIES } from '../lib/cities'
import { computeMatch, NO_LIMITS } from '../models'
import { timeline } from '../models/checkpoints'

const dir = join(__dirname, '../../public/data')
const read = (f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'))

const hikes = HikeSchema.array().parse(read('hikes.json'))
const months = HikeMonthSchema.array().parse(read('hike_month.json'))
const travel = TravelSchema.array().parse(read('travel.json'))
const cost = CostSchema.array().parse(read('cost.json'))
const advice = AdviceSchema.array().parse(read('advice.json'))
const meta = MetaSchema.parse(read('meta.json'))
const ids = new Set(hikes.map((h) => h.id))

describe('data contract', () => {
  it('has the curated 40 hikes (at least 40) with unique ids', () => {
    expect(hikes.length).toBeGreaterThanOrEqual(40)
    expect(ids.size).toBe(hikes.length)
  })

  it('has 12 months per hike', () => {
    for (const h of hikes) expect(months.filter((m) => m.hike_id === h.id).map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('has every hike x 10 cities in travel, and x 4 quarters in cost', () => {
    const codes = CITIES.map((c) => c.code).sort()
    for (const h of hikes) {
      expect(travel.filter((t) => t.hike_id === h.id).map((t) => t.city).sort()).toEqual(codes)
      for (const c of codes) expect(cost.filter((r) => r.hike_id === h.id && r.city === c).map((r) => r.quarter).sort()).toEqual([1, 2, 3, 4])
    }
  })

  it('does not reference unknown hikes', () => {
    for (const rows of [months, travel, cost, advice]) for (const r of rows) expect(ids.has(r.hike_id)).toBe(true)
  })

  it('has a valid profile for every hike, with checkpoints inside the route', () => {
    const files = new Set(readdirSync(join(dir, 'profiles')))
    for (const h of hikes) {
      expect(files.has(`${h.id}.json`)).toBe(true)
      const p = ProfileSchema.parse(read(`profiles/${h.id}.json`))
      expect(p.hike_id).toBe(h.id)
      expect(p.points.length).toBeGreaterThan(2)
      expect(p.points[0][0]).toBe(0)
      expect(p.points.at(-1)![0]).toBe(p.osm_length_m)
      expect(p.scale).toBeCloseTo(p.nps_length_m / p.osm_length_m, 2)
      expect(p.checkpoints[0].dist_m).toBe(0)
      for (const c of p.checkpoints) expect(c.dist_m).toBeLessThanOrEqual(p.osm_length_m)
    }
  })

  it('can time every hike (models run on the profiles)', () => {
    for (const h of hikes) {
      const p = ProfileSchema.parse(read(`profiles/${h.id}.json`))
      const tl = timeline(p, 7 * 60, h.route_type === 'out-and-back')
      const hours = (tl.at(-1)!.time - 7 * 60) / 60
      expect(hours, h.id).toBeGreaterThan(0.1)
      expect(hours, h.id).toBeLessThan(24)
    }
  })

  it('featured hikes have a walk_path; others do not', () => {
    for (const h of hikes) expect(Boolean(h.walk_path)).toBe(h.featured)
  })

  it('marks hikes without a station as missing temperature and rain', () => {
    for (const h of hikes.filter((x) => !x.station)) {
      for (const m of months.filter((r) => r.hike_id === h.id)) {
        expect(m.missing).toEqual(expect.arrayContaining(['temp', 'wet']))
        expect(m.tmax_p50).toBeNull()
      }
    }
  })

  it('every photo licence is one we may use', () => {
    for (const h of hikes) expect(['Public domain', 'CC0', 'CC BY', 'CC BY-SA']).toContain(h.photo.license)
  })

  it('has a source note for every cost input', () => {
    for (const k of ['fare', 'lodging', 'gas', 'fees', 'assumed']) expect(meta.cost_sources[k]?.label, k).toBeTruthy()
  })

  it('has between 5 and 10 advice cards', () => {
    expect(advice.length).toBeGreaterThanOrEqual(5)
    expect(advice.length).toBeLessThanOrEqual(10)
  })

  it('keeps the small files under the 1 MB budget (profiles excluded)', () => {
    const bytes = ['hikes', 'hike_month', 'travel', 'cost', 'advice', 'meta'].reduce((s, f) => s + readFileSync(join(dir, `${f}.json`)).length, 0)
    expect(bytes / 1024).toBeLessThan(1024)
  })

  it('declares itself fake while it is fake', () => expect(typeof (meta.fake ?? false)).toBe('boolean'))
})

describe('known answers', () => {
  it('Angels Landing, Q3, limit 60-85°F: temperature scores ~0 and the dot goes grey', () => {
    const q3 = months.filter((m) => m.hike_id === 'angels-landing' && m.month >= 7 && m.month <= 9)
    const r = computeMatch(q3, null, { ...NO_LIMITS, temp: [60, 85] })
    expect(r.factors.find((f) => f.key === 'temp')!.score).toBeLessThanOrEqual(0.05)
    expect(r.greyed).toBe(true)
  })

  it('Springdale August: 97.9°F mean high and 13.0 days at or above 100°F (docs/ai-vs-data-check.md)', () => {
    const aug = months.find((m) => m.hike_id === 'angels-landing' && m.month === 8)!
    expect(aug.tmax_p50).toBe(97.9)
    expect(aug.heat_days).toBe(13)
  })

  it('SEA to Angels Landing Q3 uses the real $169.78 fare', () => {
    const row = cost.find((c) => c.hike_id === 'angels-landing' && c.city === 'SEA' && c.quarter === 3)!
    expect(row.fare_one_way).toBe(169.78)
  })

  it('Glacier advice card keeps the real September numbers', () => {
    const card = advice.find((a) => a.hike_id === 'glacier-highline')!
    expect(card.numbers).toEqual({ '2010': 0.446, '2023': 0.766 })
  })
})
