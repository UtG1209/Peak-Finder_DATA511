// "Fit for you": one row per factor, typical value vs the user's limit, in words (the breakdown under the quarter chips).
import type { HikeMonth } from '../data/schema'
import type { MatchResult } from '../models/match'
import type { FilterState } from './filters'
import { reasonRows } from './reasons'
import { fmtTempRange } from './units'

export type FitState = 'ok' | 'past' | 'missing' | 'nolimit'

export interface FitRow {
  key: 'temp' | 'crowd' | 'smoky' | 'wet' | 'travel'
  label: string
  /** Typical value for the quarter, with its unit ("68°F", "3 days", "Busy"). */
  value: string
  /** The user's limit in words ("60–85°F", "up to 5 days", "Moderate"), or null when the slider is on Any. */
  limit: string | null
  /** Words that go with the icon: "In range", "Over by 6°F", "No station within 50 km"... */
  note: string
  /** 0 to 100 for the bar (how well this factor fits); null when the factor is not counted. */
  score: number | null
  state: FitState
}

const CROWD_WORDS = ['Quiet', 'Moderate', 'Busy']

type FitFilters = Pick<FilterState, 'temp' | 'crowd' | 'smoke' | 'rain' | 'travel' | 'from' | 'units'>

export function fitRows(result: MatchResult, months: HikeMonth[], f: FitFilters): FitRow[] {
  const words = reasonRows(result, months, f.units)
  const limitText: Record<FitRow['key'], string | null> = {
    temp: f.temp ? fmtTempRange(f.temp[0], f.temp[1], f.units) : null,
    crowd: f.crowd === null ? null : CROWD_WORDS[f.crowd],
    smoky: f.smoke === null ? null : `up to ${f.smoke} days`,
    wet: f.rain === null ? null : `up to ${f.rain} days`,
    travel: f.from && f.travel !== null ? `up to ${f.travel} h` : null,
  }
  const rows: FitRow[] = words.map((w) => {
    const factor = result.factors.find((x) => x.key === w.key)!
    const state: FitState = w.missing ? 'missing' : !factor.active ? 'nolimit' : factor.distancePast > 0 ? 'past' : 'ok'
    return { key: w.key, label: w.label, value: w.value, limit: limitText[w.key], note: w.note, score: factor.active ? Math.round(factor.score * 100) : null, state }
  })
  // The travel row only exists once a home city is chosen: say what is needed instead of leaving a gap.
  if (!rows.some((r) => r.key === 'travel')) {
    rows.push({ key: 'travel', label: 'Door to trailhead', value: '—', limit: null, note: 'Pick a home city', score: null, state: 'nolimit' })
  }
  return rows
}
