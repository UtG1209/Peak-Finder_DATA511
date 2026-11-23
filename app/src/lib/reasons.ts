// "Three reasons in words" for the hover card and the hike page: typical value + whether it fits the user's limit.
import type { MatchResult } from '../models/match'
import { crowdBand } from '../models/match'
import { quarterValues } from '../models/match'
import type { HikeMonth } from '../data/schema'
import { fmtTemp, fmtTempDelta, type Units } from './units'

export interface ReasonRow {
  key: 'temp' | 'smoky' | 'crowd' | 'wet' | 'travel'
  label: string
  value: string
  note: string
  /** The value is past the user's limit (an amber hazard with an icon and words, never colour alone). */
  warn: boolean
  /** No data for this factor: shown as a grey cell and left out of the match. */
  missing?: boolean
}

/** Words for a grey cell when a factor has no data (CLAUDE.md section 3). Temperature and rain come from the nearest weather station. */
const MISSING_NOTE: Record<string, string> = {
  temp: 'No station within 50 km',
  wet: 'No station within 50 km',
  smoky: 'No air-quality data',
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function reasonRows(result: MatchResult, months: HikeMonth[], units: Units = 'us'): ReasonRow[] {
  const q = quarterValues(months)
  const f = (k: string) => result.factors.find((x) => x.key === k)!
  const status = (k: string, over: (d: number) => string): { note: string; warn: boolean; missing?: boolean } => {
    const x = f(k)
    if (x.skippedBecause === 'missing' || x.value === null) return { note: MISSING_NOTE[k] ?? 'No data', warn: false, missing: true }
    if (!x.active) return { note: 'No limit', warn: false }
    if (x.distancePast <= 0) return { note: k === 'temp' ? 'In range' : 'OK', warn: false }
    const text = over(x.distancePast)
    // a fractional overage that rounds to zero must not read "Over by 0 days"
    return { note: parseFloat(text) === 0 ? 'Just over' : `Over by ${text}`, warn: true }
  }
  const days = (d: number) => `${d.toFixed(0)} days`
  const rows: ReasonRow[] = []
  const t = f('temp')
  rows.push({ key: 'temp', label: 'Typical high', value: t.value === null ? '—' : fmtTemp(t.value, units), ...status('temp', (d) => fmtTempDelta(d, units)) })
  const sm = q.smoky
  rows.push({ key: 'smoky', label: 'Smoky days', value: sm === null ? '—' : plural(Math.round(sm), 'day'), ...status('smoky', days) })
  const c = q.crowd
  rows.push({ key: 'crowd', label: 'Crowds', value: c === null ? '—' : crowdBand(c)[0].toUpperCase() + crowdBand(c).slice(1), ...status('crowd', (d) => `${d.toFixed(1)} levels`) })
  const w = q.wet
  rows.push({ key: 'wet', label: 'Wet days', value: w === null ? '—' : plural(Math.round(w), 'day'), ...status('wet', days) })
  const tr = f('travel')
  if (tr.value !== null) rows.push({ key: 'travel', label: 'Door to trailhead', value: `${tr.value.toFixed(1)} h`, ...status('travel', (d) => `${d.toFixed(1)} h`) })
  return rows
}
