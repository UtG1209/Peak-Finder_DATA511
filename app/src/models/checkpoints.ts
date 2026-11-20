// Checkpoint times (CLAUDE.md section 5): Tobler's hiking function on each profile step.
//   v = 6 * exp(-3.5 * |S + 0.05|) km/h,  S = rise / run
// Distances are scaled by nps_length_m / osm_length_m (OSM shortens switchbacks) BEFORE the
// slope is computed, so a longer official trail means gentler slopes. +10 min at each stop.
// Out-and-back hikes run the profile backwards for the return.
import type { Checkpoint, Profile } from '../data/schema'

export const STOP_MINUTES = 10
/** Real elevation profiles come from a ~30 m DEM and are noisy: one bad 10 m step (slope 4.0) would add days to the total.
 *  So elevations are smoothed over about 50 m and the slope is capped before Tobler is applied. */
export const SMOOTH_WINDOW_M = 50
export const MAX_SLOPE = 0.6
export const toblerSpeedKmh = (slope: number) => 6 * Math.exp(-3.5 * Math.abs(slope + 0.05))

export type Direction = 'up' | 'down' // "up" = outbound from the trailhead, "down" = the return leg

export interface TimelineEvent {
  checkpoint: Checkpoint
  dir: Direction
  /** Clock time of arrival, minutes after midnight. */
  time: number
  /** Minutes the hiker waits here before moving on (0 at the start and the finish). */
  stopMin: number
  /** Distance walked so far (scaled, metres) and elevation here (metres). */
  walkedM: number
  elevM: number
}

interface Step {
  /** Position along the profile (OSM metres) at the start and end of the step. */
  from: number
  to: number
  elevFrom: number
  elevTo: number
  /** Minutes to walk it. */
  minutes: number
  /** Scaled metres. */
  runM: number
}

export type Timeline = TimelineEvent[] & { readonly startMin: number; readonly profile: Profile }

/** Centered moving average of the elevations over ~SMOOTH_WINDOW_M (the ends use a shorter window). */
export function smoothElevations(points: [number, number][], stepM: number): number[] {
  const half = Math.max(0, Math.round(SMOOTH_WINDOW_M / Math.max(1, stepM) / 2))
  return points.map((_, i) => {
    const lo = Math.max(0, i - half)
    const hi = Math.min(points.length - 1, i + half)
    let sum = 0
    for (let j = lo; j <= hi; j++) sum += points[j][1]
    return sum / (hi - lo + 1)
  })
}

function stepsFor(profile: Profile, reverse: boolean): Step[] {
  const scale = profile.nps_length_m / profile.osm_length_m
  const raw = reverse ? [...profile.points].reverse() : profile.points
  const smooth = smoothElevations(raw, profile.step_m)
  const pts = raw.map((p, i) => [p[0], smooth[i]] as [number, number])
  const steps: Step[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [d0, e0] = pts[i]
    const [d1, e1] = pts[i + 1]
    const runM = Math.abs(d1 - d0) * scale
    if (runM === 0) continue
    const slope = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, (e1 - e0) / runM))
    const speed = toblerSpeedKmh(slope) // km/h
    steps.push({ from: d0, to: d1, elevFrom: e0, elevTo: e1, runM, minutes: (runM / 1000 / speed) * 60 })
  }
  return steps
}

/** Minutes to walk the profile between two positions along it (OSM metres), in a given leg. */
function minutesBetween(steps: Step[], a: number, b: number): number {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  let t = 0
  for (const s of steps) {
    const sLo = Math.min(s.from, s.to)
    const sHi = Math.max(s.from, s.to)
    const overlap = Math.min(hi, sHi) - Math.max(lo, sLo)
    if (overlap > 0) t += s.minutes * (overlap / (sHi - sLo))
  }
  return t
}

const elevationAt = (profile: Profile, d: number): number => {
  const pts = profile.points
  if (d <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (d <= pts[i][0]) {
      const [d0, e0] = pts[i - 1]
      const [d1, e1] = pts[i]
      return e0 + ((e1 - e0) * (d - d0)) / (d1 - d0 || 1)
    }
  }
  return pts[pts.length - 1][1]
}

/**
 * Arrival time at each checkpoint, going out and (for out-and-back) coming back.
 * @param startMin clock start time in minutes after midnight (e.g. 7:00 am = 420)
 * @param roundTrip true for out-and-back (return along the same profile); false for loops and one-way routes
 */
export function timeline(profile: Profile, startMin: number, roundTrip = true): Timeline {
  const scale = profile.nps_length_m / profile.osm_length_m
  const cps = [...profile.checkpoints].sort((a, b) => a.dist_m - b.dist_m)
  const out = stepsFor(profile, false)
  const back = roundTrip ? stepsFor(profile, true) : []
  const events: TimelineEvent[] = []
  let t = startMin
  let walked = 0
  let prev = 0

  const lastIdx = cps.length - 1
  cps.forEach((cp, i) => {
    const dt = minutesBetween(out, prev, cp.dist_m)
    t += dt
    walked += Math.abs(cp.dist_m - prev) * scale
    prev = cp.dist_m
    // No stop at the trailhead; a stop at every later checkpoint (the turnaround included) unless the walk ends here.
    const stop = i === 0 || (!roundTrip && i === lastIdx) ? 0 : STOP_MINUTES
    events.push({ checkpoint: cp, dir: 'up', time: t, stopMin: stop, walkedM: walked, elevM: elevationAt(profile, cp.dist_m) })
    t += stop
  })

  if (roundTrip) {
    for (let i = lastIdx - 1; i >= 0; i--) {
      const cp = cps[i]
      t += minutesBetween(back, prev, cp.dist_m)
      walked += Math.abs(prev - cp.dist_m) * scale
      prev = cp.dist_m
      const stop = i === 0 ? 0 : STOP_MINUTES
      events.push({ checkpoint: cp, dir: 'down', time: t, stopMin: stop, walkedM: walked, elevM: elevationAt(profile, cp.dist_m) })
      t += stop
    }
  }
  return Object.assign(events, { startMin, profile })
}

export interface Position {
  /** Position along the profile in OSM metres (what the elevation chart's x axis uses). */
  dist: number
  elev: number
  dir: Direction
  /** Next checkpoint event still ahead of the hiker, or null at the finish. */
  nextCheckpoint: TimelineEvent | null
  elapsedMin: number
  walkedM: number
}

/** Where the hiker is at clock time `t` (minutes after midnight). */
export function positionAt(tl: Timeline, t: number): Position {
  const profile = tl.profile
  const scale = profile.nps_length_m / profile.osm_length_m
  const first = tl[0]
  const last = tl[tl.length - 1]
  const elapsed = Math.max(0, t - tl.startMin)
  if (t <= first.time) return { dist: first.checkpoint.dist_m, elev: first.elevM, dir: first.dir, nextCheckpoint: tl[1] ?? null, elapsedMin: elapsed, walkedM: 0 }
  if (t >= last.time) return { dist: last.checkpoint.dist_m, elev: last.elevM, dir: last.dir, nextCheckpoint: null, elapsedMin: elapsed, walkedM: last.walkedM }

  for (let i = 0; i < tl.length - 1; i++) {
    const a = tl[i]
    const b = tl[i + 1]
    const departs = a.time + a.stopMin
    if (t < a.time || t > b.time) continue
    if (t <= departs) return { dist: a.checkpoint.dist_m, elev: a.elevM, dir: a.dir, nextCheckpoint: b, elapsedMin: elapsed, walkedM: a.walkedM } // waiting at a stop
    // Walk along the profile from a to b, spending Tobler time on each step.
    const reverse = b.dir === 'down'
    const steps = stepsFor(profile, reverse)
    let remaining = t - departs
    let pos = a.checkpoint.dist_m
    const target = b.checkpoint.dist_m
    const lo = Math.min(pos, target)
    const hi = Math.max(pos, target)
    for (const s of steps) {
      const sLo = Math.min(s.from, s.to)
      const sHi = Math.max(s.from, s.to)
      const overlap = Math.min(hi, sHi) - Math.max(lo, sLo)
      if (overlap <= 0) continue
      const cost = s.minutes * (overlap / (sHi - sLo))
      const frac = Math.min(1, remaining / cost)
      const dir = target >= a.checkpoint.dist_m ? 1 : -1
      pos += dir * overlap * frac
      remaining -= cost
      if (remaining <= 0) break
    }
    const walked = a.walkedM + Math.abs(pos - a.checkpoint.dist_m) * scale
    return { dist: pos, elev: elevationAt(profile, pos), dir: b.dir, nextCheckpoint: b, elapsedMin: elapsed, walkedM: walked }
  }
  return { dist: last.checkpoint.dist_m, elev: last.elevM, dir: last.dir, nextCheckpoint: null, elapsedMin: elapsed, walkedM: last.walkedM }
}

/** Clock time (minutes after midnight) when the hiker is back at the end of the route. */
export const finishTime = (tl: Timeline): number => tl[tl.length - 1].time

/** True if the hike is finished at or before sunset (sunset in minutes after midnight). */
export const beforeDark = (tl: Timeline, sunsetMin: number): boolean => finishTime(tl) <= sunsetMin

/** "HH:MM" -> minutes after midnight. */
export const parseClock = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes after midnight -> "7:05 am". */
export function formatClock(min: number): string {
  const m = Math.round(min) % (24 * 60)
  const h24 = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm} ${h24 < 12 ? 'am' : 'pm'}`
}

/** Default start = 1 hour after sunrise (use the chosen quarter's middle month). */
export const defaultStartMin = (sunrise: string): number => parseClock(sunrise) + 60

const EPS_MIN = 0.5

/** Index of the checkpoint event the hiker is at, or has most recently reached, at clock time `t`. -1 before the start. */
export function eventIndexAt(tl: Timeline, t: number): number {
  let idx = -1
  for (let i = 0; i < tl.length; i++) if (tl[i].time <= t + 1e-9) idx = i
  return idx
}

/**
 * Clock time of the next (`dir` = 1) or previous (`dir` = -1) checkpoint event, for the Forward / Back buttons and arrow keys.
 * In the hike's own order: for out-and-back, C0, C1 ... summit ... C1, C0. Stays at the first / last event at the ends.
 * At an arrival Back goes to the event before; while waiting at a stop, Back goes to the stop itself.
 */
export function stepTime(tl: Timeline, t: number, dir: 1 | -1): number {
  if (dir === 1) {
    for (const e of tl) if (e.time > t + EPS_MIN) return e.time
    return finishTime(tl)
  }
  for (let i = tl.length - 1; i >= 0; i--) if (tl[i].time < t - EPS_MIN) return tl[i].time
  return tl[0].time
}

/** Earliest clock time at which the hiker has walked `walkedM` metres (NPS-scaled), for dragging the marker along the profile. */
export function timeAtWalked(tl: Timeline, walkedM: number): number {
  const lo0 = tl[0].time
  const hi0 = finishTime(tl)
  if (walkedM <= 0) return lo0
  if (walkedM >= tl[tl.length - 1].walkedM) return hi0
  let lo = lo0
  let hi = hi0
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (positionAt(tl, mid).walkedM >= walkedM) hi = mid
    else lo = mid
  }
  return hi
}
