// "Three reasons in words" for the hover card and the hike page: typical value + whether it fits the user's limit.
import type { MatchResult } from '../models/match'
import { crowdBand } from '../models/match'
import { quarterValues } from '../models/match'
import type { HikeMonth } from '../data/schema'

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

export function reasonRows(result: MatchResult, months: HikeMonth[]): ReasonRow[] {
  const q = quarterValues(months)
  const f = (k: string) => result.factors.find((x) => x.key === k)!
  const status = (k: string, unit: string, round = 0): { note: string; warn: boolean; missing?: boolean } => {
    const x = f(k)
    if (x.skippedBecause === 'missing' || x.value === null) return { note: MISSING_NOTE[k] ?? 'No data', warn: false, missing: true }
    if (!x.active) return { note: 'No limit', warn: false }
    if (x.distancePast <= 0) return { note: k === 'temp' ? 'In range' : 'OK', warn: false }
    return { note: `Over by ${x.distancePast.toFixed(round)}${unit}`, warn: true }
  }
  const rows: ReasonRow[] = []
  const t = f('temp')
  rows.push({ key: 'temp', label: 'Typical high', value: t.value === null ? '—' : `${Math.round(t.value)}°F`, ...status('temp', '°F') })
  const sm = q.smoky
  rows.push({ key: 'smoky', label: 'Smoky days', value: sm === null ? '—' : plural(Math.round(sm), 'day'), ...status('smoky', ' days', 0) })
  const c = q.crowd
  const crowdStatus = status('crowd', ' levels', 1)
  rows.push({ key: 'crowd', label: 'Crowds', value: c === null ? '—' : crowdBand(c)[0].toUpperCase() + crowdBand(c).slice(1), ...crowdStatus })
  const w = q.wet
  rows.push({ key: 'wet', label: 'Wet days', value: w === null ? '—' : plural(Math.round(w), 'day'), ...status('wet', ' days', 0) })
  const tr = f('travel')
  if (tr.value !== null) rows.push({ key: 'travel', label: 'Door to trailhead', value: `${tr.value.toFixed(1)} h`, ...status('travel', ' h', 1) })
  return rows
}
