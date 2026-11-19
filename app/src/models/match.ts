// Match % model (CLAUDE.md section 5). Pure functions: no React, no fetching.
//
// match = 100 * mean over active factors of max(0, 1 - distance_past_limit / tolerance)
// A factor is "active" when the user set a limit for it AND data exists. Sliders on "Any"
// are not counted; factors with missing data are left out and listed in `skipped`.
import type { HikeMonth, Travel } from '../data/schema'

export type FactorKey = 'temp' | 'crowd' | 'smoky' | 'wet' | 'travel'

/** Distance past the limit at which a factor scores 0. Starting values: tune after user test 1. */
export const TOLERANCE: Record<FactorKey, number> = {
  temp: 10, // °F outside the band
  crowd: 2, // crowd levels above the limit (see crowdLevel)
  smoky: 5, // smoky days in the quarter
  wet: 10, // wet days in the quarter
  travel: 2, // hours door to trailhead
}

/** Crowd bands: crowd_level < 0.4 quiet, < 0.7 moderate, else busy. */
export const CROWD_EDGES = [0.4, 0.7] as const
/** Highest allowed band: 0 = Quiet, 1 = Moderate, 2 = Busy. null = Any. */
export type CrowdLimit = 0 | 1 | 2 | null

export interface Limits {
  /** Comfortable daytime high band in °F, inclusive. null = Any. */
  temp: [number, number] | null
  crowd: CrowdLimit
  /** Max smoky days in the quarter. null = Any. */
  smoky: number | null
  /** Max wet days in the quarter. null = Any. */
  wet: number | null
  /** Max door-to-trailhead hours. null = Any or no home city. */
  travelHr: number | null
}

export const NO_LIMITS: Limits = { temp: null, crowd: null, smoky: null, wet: null, travelHr: null }

/**
 * Maps the 0..1 crowd ratio onto a continuous "levels" scale so that one level is one band:
 * 0 -> 0, 0.4 -> 1 (top of Quiet), 0.7 -> 2 (top of Moderate), 1 -> 3.
 * A Quiet limit is therefore 1, Moderate 2, Busy 3.
 */
export function crowdLevel(ratio: number): number {
  const [a, b] = CROWD_EDGES
  if (ratio <= a) return (ratio / a) * 1
  if (ratio <= b) return 1 + ((ratio - a) / (b - a)) * 1
  return 2 + ((ratio - b) / (1 - b)) * 1
}

/** Band word for a 0..1 crowd ratio, shared by the match model, cards and the month strip. */
export const crowdBand = (ratio: number): 'quiet' | 'moderate' | 'busy' => (ratio < CROWD_EDGES[0] ? 'quiet' : ratio < CROWD_EDGES[1] ? 'moderate' : 'busy')

export interface FactorResult {
  key: FactorKey
  /** The hike's typical value for the quarter (°F, level, days, hours). null when unknown. */
  value: number | null
  /** Human-readable limit, e.g. "60–85°F". null when the slider is on Any. */
  limit: string | null
  distancePast: number
  tolerance: number
  /** 0..1 */
  score: number
  active: boolean
  /** Why the factor is not counted: 'any' (no limit), 'missing' (no data), 'no-city'. */
  skippedBecause?: 'any' | 'missing' | 'no-city'
}

export interface MatchResult {
  /** 0..100. 100 when no factor is active (nothing to fail). */
  match: number
  factors: FactorResult[]
  /** Any active factor scored 0: draw a small hollow grey dot (but keep the number). */
  greyed: boolean
  /** Factors left out because their data is missing, for "the card says so". */
  skipped: FactorKey[]
  /** The quarter has at least one closed month. */
  hasClosedMonth: boolean
}

export interface QuarterValues {
  temp: number | null // mean of the three monthly median highs
  crowd: number | null // mean crowd ratio
  smoky: number | null // sum of smoky days
  wet: number | null // sum of wet days
  missing: Set<string>
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
const known = (xs: (number | null)[]): number[] | null => (xs.every((x) => x !== null) ? (xs as number[]) : null)

/** A factor's quarter value: mean of three monthly medians (sum for day counts). */
export function quarterValues(months: HikeMonth[]): QuarterValues {
  const missing = new Set(months.flatMap((m) => m.missing))
  const temps = known(months.map((m) => m.tmax_p50))
  const wets = known(months.map((m) => m.wet_days))
  return {
    temp: !missing.has('temp') && temps ? mean(temps) : null,
    crowd: !missing.has('crowd') && months.length ? mean(months.map((m) => m.crowd_level)) : null,
    smoky: !missing.has('smoky') && months.length ? sum(months.map((m) => m.smoky_days)) : null,
    wet: !missing.has('wet') && wets ? sum(wets) : null,
    missing,
  }
}

/** Hours door to trailhead using the hike's default mode (drive, or fly + drive). */
export const travelHours = (t: Travel): number => (t.default_mode === 'fly' ? t.fly_drive_hr : t.drive_hr)

const score = (distancePast: number, tolerance: number) => Math.max(0, 1 - distancePast / tolerance)
const CROWD_LIMIT_LABEL = ['Quiet', 'Moderate', 'Busy']

/**
 * @param months the three HikeMonth rows of the chosen quarter
 * @param travel the hike's travel row for the chosen home city, or null if no city is picked
 */
export function computeMatch(months: HikeMonth[], travel: Travel | null, limits: Limits): MatchResult {
  const q = quarterValues(months)
  const factors: FactorResult[] = []

  const add = (
    key: FactorKey,
    value: number | null,
    limitLabel: string | null,
    hasLimit: boolean,
    pastFn: (v: number) => number,
    noCity = false,
  ) => {
    const tolerance = TOLERANCE[key]
    if (!hasLimit) {
      factors.push({ key, value, limit: null, distancePast: 0, tolerance, score: 1, active: false, skippedBecause: noCity ? 'no-city' : 'any' })
      return
    }
    if (value === null) {
      factors.push({ key, value, limit: limitLabel, distancePast: 0, tolerance, score: 1, active: false, skippedBecause: 'missing' })
      return
    }
    const distancePast = Math.max(0, pastFn(value))
    factors.push({ key, value, limit: limitLabel, distancePast, tolerance, score: score(distancePast, tolerance), active: true })
  }

  const [lo, hi] = limits.temp ?? [0, 0]
  add('temp', q.temp, limits.temp ? `${lo}–${hi}°F` : null, limits.temp !== null, (v) => Math.max(lo - v, v - hi))

  const crowdValue = q.crowd === null ? null : crowdLevel(q.crowd)
  const crowdCap = limits.crowd === null ? 0 : limits.crowd + 1
  add('crowd', crowdValue, limits.crowd === null ? null : CROWD_LIMIT_LABEL[limits.crowd], limits.crowd !== null, (v) => v - crowdCap)

  add('smoky', q.smoky, limits.smoky === null ? null : `${limits.smoky} days`, limits.smoky !== null, (v) => v - (limits.smoky ?? 0))
  add('wet', q.wet, limits.wet === null ? null : `${limits.wet} days`, limits.wet !== null, (v) => v - (limits.wet ?? 0))

  const hours = travel ? travelHours(travel) : null
  add('travel', hours, limits.travelHr === null ? null : `${limits.travelHr} h`, limits.travelHr !== null, (v) => v - (limits.travelHr ?? 0), limits.travelHr === null)

  const active = factors.filter((f) => f.active)
  const matchValue = active.length ? (100 * sum(active.map((f) => f.score))) / active.length : 100
  return {
    match: matchValue,
    factors,
    greyed: active.some((f) => f.score === 0),
    skipped: factors.filter((f) => f.skippedBecause === 'missing').map((f) => f.key),
    hasClosedMonth: months.some((m) => m.closed),
  }
}

/** Best quarter = highest match; a tie goes to the cheaper quarter. */
export function bestQuarter(matches: number[], costs?: (number | null)[]): number {
  let best = 0
  for (let i = 1; i < matches.length; i++) {
    const diff = matches[i] - matches[best]
    if (diff > 1e-9) best = i
    else if (Math.abs(diff) <= 1e-9) {
      const ci = costs?.[i] ?? Infinity
      const cb = costs?.[best] ?? Infinity
      if (ci < cb) best = i
    }
  }
  return best
}
