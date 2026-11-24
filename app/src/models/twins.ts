// Hike twins (CLAUDE.md section 5): z-score length, gain, top elevation and the 12 monthly typical highs; the 3 nearest hikes, at least one from another park.
import type { Hike, HikeMonth } from '../data/schema'

export type TwinFactor = 'length' | 'gain' | 'top' | 'climate'
export interface Twin { id: string; distance: number; /** the two factors where this twin is closest, best first */ why: [TwinFactor, TwinFactor] }

type Vec = { length: number; gain: number; top: number; climate: number[] }

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1 }

/** Twelve monthly highs; a missing month takes the hike's own mean (all missing: null, scored as the average hike). */
const highs = (rows: HikeMonth[] | undefined): (number | null)[] => {
  const by = new Map((rows ?? []).map((r) => [r.month, r.tmax_p50]))
  const known = [...by.values()].filter((v): v is number => v != null)
  const fill = known.length ? mean(known) : null
  return Array.from({ length: 12 }, (_, i) => by.get(i + 1) ?? fill)
}

export function findTwins(hikeId: string, hikes: Hike[], months: Map<string, HikeMonth[]>, count = 3): Twin[] {
  const self = hikes.find((h) => h.id === hikeId)
  if (!self) return []
  const raw = hikes.map((h) => ({ h, t: highs(months.get(h.id)) }))
  const scalar = (get: (h: Hike) => number) => { const v = hikes.map(get); const m = mean(v), s = sd(v); return (h: Hike) => (get(h) - m) / s }
  const zs = { length: scalar((h) => h.length_mi), gain: scalar((h) => h.gain_ft), top: scalar((h) => h.max_elev_ft) }
  const zm = Array.from({ length: 12 }, (_, i) => {
    const v = raw.map((r) => r.t[i]).filter((x): x is number => x != null)
    return { m: v.length ? mean(v) : 0, s: v.length ? sd(v) : 1 }
  })
  const vec = new Map<string, Vec>(raw.map(({ h, t }) => [h.id, {
    length: zs.length(h), gain: zs.gain(h), top: zs.top(h),
    climate: t.map((x, i) => (x == null ? 0 : (x - zm[i].m) / zm[i].s)),
  }]))
  const a = vec.get(hikeId)!
  const scored = hikes.filter((h) => h.id !== hikeId).map((h) => {
    const b = vec.get(h.id)!
    const d = { length: Math.abs(a.length - b.length), gain: Math.abs(a.gain - b.gain), top: Math.abs(a.top - b.top), climate: Math.sqrt(mean(a.climate.map((x, i) => (x - b.climate[i]) ** 2))) }
    // climate counts as one dimension per month in the distance, so it carries the weight of 12 of the 15 features
    const distance = Math.sqrt(d.length ** 2 + d.gain ** 2 + d.top ** 2 + a.climate.reduce((s, x, i) => s + (x - b.climate[i]) ** 2, 0))
    const why = (Object.keys(d) as TwinFactor[]).sort((x, y) => d[x] - d[y]).slice(0, 2) as [TwinFactor, TwinFactor]
    return { h, twin: { id: h.id, distance, why } satisfies Twin }
  }).sort((x, y) => x.twin.distance - y.twin.distance || x.h.id.localeCompare(y.h.id))
  const top = scored.slice(0, count)
  if (!top.some((s) => s.h.park_code !== self.park_code)) {
    const other = scored.find((s) => s.h.park_code !== self.park_code)
    if (other && top.length) top[top.length - 1] = other
  }
  return top.map((s) => s.twin)
}
