// Pure helpers behind the "On the trail" section (the elevation profile with time).
import type { Profile } from '../data/schema'
import { parseClock, smoothElevations, type Timeline, type TimelineEvent } from '../models/checkpoints'

export interface TrailPoint {
  /** Distance walked so far in NPS-scaled metres (the chart's x). */
  walkedM: number
  /** Elevation in metres (the chart's y). */
  elevM: number
  dir: 'up' | 'down'
}

/**
 * The curve drawn on the chart. x is the distance walked (so an out-and-back hike is two humps: the climb, then the return),
 * y is elevation. Elevation is smoothed the same way as for the time model, so the chart shows what the times were computed from.
 */
export function trailCurve(profile: Profile, roundTrip: boolean): TrailPoint[] {
  const scale = profile.nps_length_m / profile.osm_length_m
  const smooth = smoothElevations(profile.points, profile.step_m)
  const out: TrailPoint[] = profile.points.map(([d], i) => ({ walkedM: d * scale, elevM: smooth[i], dir: 'up' }))
  if (!roundTrip) return out
  const lastD = profile.points[profile.points.length - 1][0]
  const back: TrailPoint[] = []
  for (let i = profile.points.length - 2; i >= 0; i--) back.push({ walkedM: (lastD + (lastD - profile.points[i][0])) * scale, elevM: smooth[i], dir: 'down' })
  return [...out, ...back]
}

/** The turnaround (summit) event: the last one on the way up. For a one-way route or a loop it is the finish. */
export const turnaroundEvent = (tl: Timeline): TimelineEvent => [...tl].reverse().find((e) => e.dir === 'up') ?? tl[tl.length - 1]

export interface DaylightVerdict {
  sunriseMin: number
  sunsetMin: number
  startMin: number
  finishMin: number
  startsBeforeSunrise: boolean
  finishesAfterSunset: boolean
  /** Minutes between finishing and sunset. Negative = finishing after dark. */
  marginMin: number
}

export function daylightVerdict(tl: Timeline, sunrise: string, sunset: string): DaylightVerdict {
  const sunriseMin = parseClock(sunrise)
  const sunsetMin = parseClock(sunset)
  const finishMin = tl[tl.length - 1].time
  return {
    sunriseMin,
    sunsetMin,
    startMin: tl.startMin,
    finishMin,
    startsBeforeSunrise: tl.startMin < sunriseMin,
    finishesAfterSunset: finishMin > sunsetMin,
    marginMin: sunsetMin - finishMin,
  }
}

/** 275 -> "4 h 35 min"; 60 -> "1 h"; 25 -> "25 min". */
export function durationLabel(min: number): string {
  const m = Math.round(Math.abs(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

/** "C0", "C1" ... for a checkpoint id like "c3" (falls back to the id upper-cased). */
export const checkpointLabel = (id: string): string => id.toUpperCase()

/**
 * Latest start that still finishes at sunset. Walking times do not depend on the clock, so moving the start moves the finish by
 * the same amount: latest start = start + margin.
 */
export const latestStart = (v: DaylightVerdict): number => v.startMin + v.marginMin

/** The section's answer sentence, e.g. "Back at 12:44 pm, long before dark". `roundTrip` false reads "Done at". */
export function trailHeadline(v: DaylightVerdict, roundTrip: boolean, fmt: (min: number) => string): string {
  const lead = `${roundTrip ? 'Back' : 'Done'} at ${fmt(v.finishMin)}`
  if (v.finishesAfterSunset) return `${lead}, ${durationLabel(-v.marginMin)} after dark`
  if (v.marginMin >= 120) return `${lead}, long before dark`
  if (v.marginMin >= 30) return `${lead}, before dark`
  return `${lead}, only ${durationLabel(v.marginMin)} before sunset`
}

/** Hour ticks every `every` hours from lo to hi (clock minutes): "6 am", "8", "10", "noon", "2 pm" ... the last one "6 pm". */
export function hourTicks(lo: number, hi: number, every = 2): { min: number; label: string }[] {
  const out: { min: number; label: string }[] = []
  const first = Math.ceil(lo / 60 / every) * every
  for (let h = first; h * 60 <= hi; h += every) out.push({ min: h * 60, label: '' })
  let pmShown = false
  out.forEach((t, i) => {
    const h24 = (t.min / 60) % 24
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    const pm = h24 >= 12
    const suffix = i === 0 || i === out.length - 1 || (pm && !pmShown && h24 !== 12)
    if (pm && h24 !== 12) pmShown = true
    t.label = h24 === 12 ? 'noon' : h24 === 0 ? 'midnight' : suffix ? `${h12} ${pm ? 'pm' : 'am'}` : String(h12)
  })
  return out
}
