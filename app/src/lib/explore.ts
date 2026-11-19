// Pure helpers behind the Explore screen: score every hike for the current filters, and find the
// "one change that brings hikes back" for the empty state (UX rule 4: never a dead end).
import type { DataIndex, Dataset } from '../data/loaders'
import { quarterMonths, travelFor } from '../data/loaders'
import type { Hike, HikeMonth } from '../data/schema'
import { computeMatch, type MatchResult } from '../models/match'
import { toLimits, type FilterState } from './filters'

export interface HikeRow {
  hike: Hike
  months: HikeMonth[]
  result: MatchResult
  /** Fails a limit (grey, hollow dot, still on the map) because of a score of 0 or a category filter. */
  out: boolean
}

export function evaluate(data: Dataset, index: DataIndex, f: FilterState): HikeRow[] {
  const limits = toLimits(f)
  return data.hikes
    .map((hike) => {
      const months = quarterMonths(index, hike.id, f.q)
      const result = computeMatch(months, travelFor(index, hike.id, f.from), limits)
      const categoryOut = (f.diff.length > 0 && !f.diff.includes(hike.difficulty)) || (f.has3d && !hike.featured)
      return { hike, months, result, out: result.greyed || categoryOut }
    })
    .sort((a, b) => Number(a.out) - Number(b.out) || b.result.match - a.result.match || a.hike.name.localeCompare(b.hike.name))
}

export const countFitting = (rows: HikeRow[]) => rows.filter((r) => !r.out).length

export interface Relaxation {
  label: string
  gain: number
  patch: Partial<FilterState>
}

/** The single limit to loosen that brings back the most hikes, e.g. "Allowing Busy crowds adds 6". */
export function bestRelaxation(data: Dataset, index: DataIndex, f: FilterState): Relaxation | null {
  const base = countFitting(evaluate(data, index, f))
  const options: { label: string; active: boolean; patch: Partial<FilterState> }[] = [
    { label: 'Busy crowds', active: f.crowd !== null && f.crowd < 2, patch: { crowd: null } },
    { label: 'any temperature', active: f.temp !== null, patch: { temp: null } },
    { label: 'any number of smoky days', active: f.smoke !== null, patch: { smoke: null } },
    { label: 'any number of wet days', active: f.rain !== null, patch: { rain: null } },
    { label: 'any travel time', active: f.travel !== null && f.from !== null, patch: { travel: null } },
    { label: 'every difficulty', active: f.diff.length > 0, patch: { diff: [] } },
    { label: 'hikes without a 3D walk', active: f.has3d, patch: { has3d: false } },
  ]
  let best: Relaxation | null = null
  for (const o of options) {
    if (!o.active) continue
    const gain = countFitting(evaluate(data, index, { ...f, ...o.patch })) - base
    if (gain > 0 && (!best || gain > best.gain)) best = { label: o.label, gain, patch: o.patch }
  }
  return best
}
