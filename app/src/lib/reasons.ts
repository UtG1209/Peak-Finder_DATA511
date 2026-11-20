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
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function reasonRows(result: MatchResult, months: HikeMonth[]): ReasonRow[] {
  const q = quarterValues(months)
  const f = (k: string) => result.factors.find((x) => x.key === k)!
  const status = (k: string, unit: string, round = 0): { note: string; warn: boolean } => {
    const x = f(k)
    if (x.skippedBecause === 'missing') return { note: 'No data', warn: false }
    if (!x.active) return { note: 'No limit', warn: false }
    if (x.distancePast <= 0) return { note: k === 'temp' ? 'In range' : 'OK', warn: false }
    const over = x.distancePast.toFixed(round)
    // a fractional overage that rounds to zero must not read "Over by 0 days"
    return { note: Number(over) === 0 ? 'Just over' : `Over by ${over}${unit}`, warn: true }
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
