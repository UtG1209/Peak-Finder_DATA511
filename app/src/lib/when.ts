// Words for the "When" block (v2): one "why" line per quarter card, the section's answer sentence, and the hazard chips over the month chart.
// Pure: reads the match result and the typical months, never the DOM.
import type { HikeMonth, Quarter } from '../data/schema'
import { crowdBand, quarterValues, type MatchResult } from '../models/match'
import type { FilterState } from './filters'
import { MONTH_NAMES, QUARTERS } from './quarters'
import { fmtTemp, fmtTempDelta, fmtTempRange, type Units } from './units'

type WhenFilters = Pick<FilterState, 'temp' | 'crowd' | 'smoke' | 'rain' | 'units'>

const CROWD_LIMIT = ['quiet', 'moderate', 'busy']
const LEFT_OUT: Record<string, string> = { temp: 'temperature', wet: 'wet days', smoky: 'smoky days', crowd: 'crowds' }
const n1 = (n: number) => String(Number(n.toFixed(1)))
const days = (n: number) => `${n1(n)} ${Number(n1(n)) === 1 ? 'day' : 'days'}`

export interface QuarterWhy {
  /** Short line on the card: the limiting factor with its typical value, or the quarter in two words when everything fits. */
  why: string
  /** Middle of a sentence: "averages 97°F, 12°F past your 85°F limit". null when nothing is past a limit. */
  clause: string | null
  /** "1 factor left out: temperature" when data is missing, else null. */
  leftOut: string | null
}

export function quarterWhy(result: MatchResult, months: HikeMonth[], f: WhenFilters): QuarterWhy {
  const u: Units = f.units
  const qv = quarterValues(months)
  const band = qv.crowd === null ? null : crowdBand(qv.crowd)
  const leftOut = result.skipped.length
    ? `${result.skipped.length} ${result.skipped.length === 1 ? 'factor' : 'factors'} left out: ${result.skipped.map((k) => LEFT_OUT[k] ?? k).join(', ')}`
    : null
  // the worst active factor that is past its limit names the quarter
  const worst = result.factors.filter((x) => x.active && x.distancePast > 0).sort((a, b) => a.score - b.score)[0]
  if (!worst || worst.value === null) {
    const temp = qv.temp === null ? null : `${fmtTemp(qv.temp, u)} typical`
    return { why: [temp, band].filter(Boolean).join(', ') || 'Typical values, past years', clause: null, leftOut }
  }
  const v = worst.value
  const d = worst.distancePast
  switch (worst.key) {
    case 'temp': {
      const [lo, hi] = f.temp ?? [v, v]
      const hot = v > hi
      const delta = fmtTempDelta(d, u)
      return {
        why: `${hot ? 'Too hot' : 'Too cold'}: ${fmtTemp(v, u)}, ${delta} ${hot ? 'past' : 'under'} your limit`,
        clause: `averages ${fmtTemp(v, u)}, ${delta} ${hot ? 'past' : 'under'} your ${fmtTemp(hot ? hi : lo, u)} limit`,
        leftOut,
      }
    }
    case 'crowd':
      return { why: `Too busy: ${band} crowds`, clause: `is ${band}, busier than the ${CROWD_LIMIT[f.crowd ?? 2]} you accept`, leftOut }
    case 'smoky':
    case 'wet': {
      const word = worst.key === 'smoky' ? 'smoky' : 'wet'
      return {
        why: `${worst.key === 'smoky' ? 'Smoky' : 'Wet'}: ${days(v)}, ${n1(d)} past your limit`,
        clause: `has ${days(v)} ${word}, ${n1(d)} past your limit of ${worst.key === 'smoky' ? f.smoke : f.rain}`,
        leftOut,
      }
    }
    case 'travel':
      return { why: `Far: ${n1(v)} h away, ${n1(d)} h past your limit`, clause: `is ${n1(v)} h door to trailhead, ${n1(d)} h past your limit`, leftOut }
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** Section title and the answer under it: "Autumn is the pick; summer is out" + "Q4 runs a typical 67°F with moderate crowds. Q3 averages ...". */
export function whenAnswer(matches: MatchResult[], quarters: HikeMonth[][], best: Quarter, f: WhenFilters): { title: string; answer: string } {
  const season = (q: Quarter) => QUARTERS[q - 1].season
  const out = QUARTERS.filter(({ q }) => matches[q - 1].greyed).map(({ q }) => q)
  const title = `${cap(season(best))} is the pick${out.length && !out.includes(best) ? `; ${list(out.map(season))} ${out.length === 1 ? 'is' : 'are'} out` : ''}`
  const bv = quarterValues(quarters[best - 1])
  const band = bv.crowd === null ? null : crowdBand(bv.crowd)
  const first = bv.temp !== null
    ? `Q${best} runs a typical ${fmtTemp(bv.temp, f.units)}${band ? ` with ${band} crowds` : ''}.`
    : `Q${best} has typically ${band ?? 'unknown'} crowds; there is no weather station within 50 km.`
  const anyLimit = matches[0].factors.some((x) => x.active || x.skippedBecause === 'missing')
  if (!anyLimit) return { title, answer: `${first} You have not set any limits yet, so every quarter matches 100%. Set some on the map.` }
  // explain the lowest-scoring quarter that is past a limit
  const worst = QUARTERS.map(({ q }) => q).filter((q) => q !== best).sort((a, b) => matches[a - 1].match - matches[b - 1].match)[0]
  const why = worst ? quarterWhy(matches[worst - 1], quarters[worst - 1], f).clause : null
  return { title, answer: why ? `${first} Q${worst} ${why}, so it scores ${Math.round(matches[worst - 1].match)}%.` : first }
}

export interface HazardChip {
  key: 'heat' | 'smoke' | 'snow' | 'closed'
  months: number[]
  text: string
}

const span = (ms: number[]) =>
  ms.length > 1 && ms[ms.length - 1] - ms[0] === ms.length - 1 ? `${MONTH_NAMES[ms[0] - 1]} to ${MONTH_NAMES[ms[ms.length - 1] - 1]}` : list(ms.map((m) => MONTH_NAMES[m - 1]))
const counts = (xs: number[]) => list(xs.map(n1))

/** One amber chip per hazard over the year: "Heat: 13, 20 and 11 days at or above 100°F, Jun to Aug". */
export function hazardChips(year: HikeMonth[], units: Units): HazardChip[] {
  const sorted = [...year].sort((a, b) => a.month - b.month)
  const pick = (fn: (m: HikeMonth) => number | null) => sorted.filter((m) => (fn(m) ?? 0) >= 1)
  const chips: HazardChip[] = []
  const heat = pick((m) => m.heat_days)
  if (heat.length) chips.push({ key: 'heat', months: heat.map((m) => m.month), text: `Heat: ${counts(heat.map((m) => m.heat_days!))} days at or above ${fmtTemp(100, units)}, ${span(heat.map((m) => m.month))}` })
  const smoke = pick((m) => m.smoky_days)
  if (smoke.length) chips.push({ key: 'smoke', months: smoke.map((m) => m.month), text: `Smoke: ${counts(smoke.map((m) => m.smoky_days))} smoky days, ${span(smoke.map((m) => m.month))}` })
  const snow = pick((m) => m.snow_days)
  if (snow.length) chips.push({ key: 'snow', months: snow.map((m) => m.month), text: `Snow: ${counts(snow.map((m) => m.snow_days!))} snow days, ${span(snow.map((m) => m.month))}` })
  const closed = sorted.filter((m) => m.closed)
  if (closed.length) chips.push({ key: 'closed', months: closed.map((m) => m.month), text: `Closed: ${list(closed.map((m) => MONTH_NAMES[m.month - 1]))}` })
  return chips
}

/** One month in words: for the column button, the tooltip and screen readers. */
export function monthWords(m: HikeMonth, u: Units) {
  const band = crowdBand(m.crowd_level)
  return {
    high: m.tmax_p50 === null ? 'No station within 50 km' : `High ${fmtTemp(m.tmax_p50, u)}${m.tmax_p25 !== null && m.tmax_p75 !== null ? ` (${fmtTempRange(Math.round(m.tmax_p25), Math.round(m.tmax_p75), u)})` : ''}`,
    crowd: `Crowds ${band}, ${m.crowd_level.toFixed(2)} of the busiest month`,
    days: m.wet_days === null ? `${n1(m.smoky_days)} smoky days, no rain data` : `${n1(m.smoky_days)} smoky, ${n1(m.wet_days)} wet days`,
    light: `${m.daylight_hr.toFixed(1)} h daylight`,
  }
}

