// All Explore state lives in the URL (CLAUDE.md section 2):
//   ?from=SEA&q=3&temp=55-80&crowd=2&smoke=3&rain=10&travel=8&diff=easy,moderate&3d=1&go=1&pick=<id>&view=3d
// A missing parameter means "Any" / wide open, so the map is never empty on arrival.
import type { Quarter } from '../data/schema'
import type { Difficulty } from './difficulty'
import { CITIES } from './cities'
import { defaultQuarter } from './quarters'
import type { CrowdLimit, Limits } from '../models/match'

export type { Difficulty }
export const DIFFICULTIES: Difficulty[] = ['easy', 'moderate', 'hard']

export interface FilterState {
  from: string | null // home city code, or null for "Skip"
  q: Quarter
  temp: [number, number] | null // °F band
  crowd: CrowdLimit // 0 Quiet, 1 Moderate, 2 Busy, null Any
  smoke: number | null
  rain: number | null
  travel: number | null // max hours
  diff: Difficulty[] // empty = all
  has3d: boolean
  /** The user pressed "Show hikes": until then the map is blurred and the guide asks what to do next. */
  go: boolean
  /** The hike whose photo tile is open on the map (clicked, not yet opened). Lives in the URL so Back from the hike page returns to the same tile. */
  pick: string | null
  /** '3d' shows the opt-in Three.js view instead of the 2D map. Written to the URL only when 3D (`view=3d`). */
  view: '2d' | '3d'
}

/** Slider ranges shown in the UI (also the "wide open" ends). */
export const RANGES = {
  temp: [0, 110] as const,
  smoke: [0, 30] as const,
  rain: [0, 30] as const,
  travel: [0, 24] as const,
}

export const defaultFilters = (today = new Date()): FilterState => ({
  from: null,
  q: defaultQuarter(today),
  temp: null,
  crowd: null,
  smoke: null,
  rain: null,
  travel: null,
  diff: [],
  has3d: false,
  go: false,
  pick: null,
  view: '2d',
})

const int = (v: string | null): number | null => {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseFilters(params: URLSearchParams, today = new Date()): FilterState {
  const base = defaultFilters(today)
  const from = params.get('from')
  const q = int(params.get('q'))
  const tempRaw = params.get('temp')
  const tm = tempRaw?.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/)
  const temp: [number, number] | null = tm ? [Number(tm[1]), Number(tm[2])] : null
  const crowd = int(params.get('crowd'))
  const diff = (params.get('diff') ?? '').split(',').filter((d): d is Difficulty => (DIFFICULTIES as string[]).includes(d))
  return {
    from: from && CITIES.some((c) => c.code === from) ? from : null,
    q: q && q >= 1 && q <= 4 ? (q as Quarter) : base.q,
    temp: temp && temp[0] <= temp[1] ? temp : null,
    crowd: crowd === 0 || crowd === 1 || crowd === 2 ? crowd : null,
    smoke: int(params.get('smoke')),
    rain: int(params.get('rain')),
    travel: int(params.get('travel')),
    diff,
    has3d: params.get('3d') === '1',
    go: params.get('go') === '1',
    pick: /^[a-z0-9-]{1,60}$/.test(params.get('pick') ?? '') ? params.get('pick') : null,
    view: params.get('view') === '3d' ? '3d' : '2d',
  }
}

/** Only non-default values are written, so a fresh URL stays short. The quarter is always written (it is the main control). */
export function serializeFilters(f: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.from) p.set('from', f.from)
  p.set('q', String(f.q))
  if (f.temp) p.set('temp', `${f.temp[0]}-${f.temp[1]}`)
  if (f.crowd !== null) p.set('crowd', String(f.crowd))
  if (f.smoke !== null) p.set('smoke', String(f.smoke))
  if (f.rain !== null) p.set('rain', String(f.rain))
  if (f.travel !== null) p.set('travel', String(f.travel))
  if (f.diff.length) p.set('diff', f.diff.join(','))
  if (f.has3d) p.set('3d', '1')
  if (f.go) p.set('go', '1')
  if (f.pick) p.set('pick', f.pick)
  if (f.view === '3d') p.set('view', '3d')
  return p
}

/** URL filters -> model limits. Travel only counts when a home city is chosen. */
export const toLimits = (f: FilterState): Limits => ({
  temp: f.temp,
  crowd: f.crowd,
  smoky: f.smoke,
  wet: f.rain,
  travelHr: f.from ? f.travel : null,
})
