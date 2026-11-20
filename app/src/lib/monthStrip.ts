// "Month by month" strip: 12 columns of typical high, crowds, smoky days, wet days and daylight, plus a hazard row.
// Pure: decides what each cell says and whether it is past the user's limits. The component only draws it.
import type { HikeMonth } from '../data/schema'
import { crowdBand, crowdLevel } from '../models/match'
import type { FilterState } from './filters'
import { MONTH_NAMES, QUARTERS } from './quarters'
import { fmtTemp, type Units } from './units'

export type CellState = 'ok' | 'past' | 'missing' | 'none'

export interface Cell {
  text: string
  state: CellState
  /** Extra words for hover and screen readers ("Past your limit", "No station within 50 km"). */
  note: string
}

export interface Hazard {
  key: 'heat' | 'smoke' | 'snow' | 'closed'
  /** "Heat 13 days" */
  text: string
}

export interface Column {
  month: number
  name: string
  /** 1..4: which quarter this month belongs to (used to frame the chosen quarter's three months). */
  quarter: 1 | 2 | 3 | 4
  inChosenQuarter: boolean
  firstOfQuarter: boolean
  lastOfQuarter: boolean
  temp: Cell
  crowd: Cell
  smoky: Cell
  wet: Cell
  daylight: Cell
  hazards: Hazard[]
}

type StripFilters = Pick<FilterState, 'temp' | 'crowd' | 'smoke' | 'rain' | 'q' | 'units'>

const SHARE = 3 // quarter limits on days are spread over 3 months: a month is marked when it alone is above one third

const dayText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? 'day' : 'days'}`

export function stripColumns(months: HikeMonth[], f: StripFilters, units: Units): Column[] {
  const sorted = [...months].sort((a, b) => a.month - b.month)
  return sorted.map((m): Column => {
    const quarter = QUARTERS[Math.floor((m.month - 1) / 3)]
    const missing = new Set(m.missing)
    const noStation: Cell = { text: '—', state: 'missing', note: 'No station within 50 km' }

    let temp: Cell
    if (missing.has('temp') || m.tmax_p50 === null) temp = noStation
    else {
      const past = f.temp !== null && (m.tmax_p50 < f.temp[0] || m.tmax_p50 > f.temp[1])
      temp = { text: fmtTemp(m.tmax_p50, units), state: f.temp === null ? 'none' : past ? 'past' : 'ok', note: past ? 'Outside your temperature range' : '' }
    }

    const level = crowdLevel(m.crowd_level)
    const crowdPast = f.crowd !== null && level > f.crowd + 1
    const band = crowdBand(m.crowd_level)
    const crowd: Cell = { text: band[0].toUpperCase() + band.slice(1), state: f.crowd === null ? 'none' : crowdPast ? 'past' : 'ok', note: crowdPast ? 'Busier than you accept' : '' }

    const smokyPast = f.smoke !== null && m.smoky_days > f.smoke / SHARE
    const smoky: Cell = { text: dayText(m.smoky_days), state: f.smoke === null ? 'none' : smokyPast ? 'past' : 'ok', note: smokyPast ? 'More than a third of your smoky-day limit' : '' }

    let wet: Cell
    if (missing.has('wet') || m.wet_days === null) wet = noStation
    else {
      const past = f.rain !== null && m.wet_days > f.rain / SHARE
      wet = { text: dayText(m.wet_days), state: f.rain === null ? 'none' : past ? 'past' : 'ok', note: past ? 'More than a third of your wet-day limit' : '' }
    }

    const hazards: Hazard[] = []
    if (m.closed) hazards.push({ key: 'closed', text: 'Closed' })
    if (m.heat_days !== null && m.heat_days >= 1) hazards.push({ key: 'heat', text: `Heat ${dayText(m.heat_days)}` })
    if (m.smoky_days >= 1) hazards.push({ key: 'smoke', text: `Smoke ${dayText(m.smoky_days)}` })
    if (m.snow_days !== null && m.snow_days >= 1) hazards.push({ key: 'snow', text: `Snow ${dayText(m.snow_days)}` })

    return {
      month: m.month,
      name: MONTH_NAMES[m.month - 1],
      quarter: quarter.q,
      inChosenQuarter: quarter.q === f.q,
      firstOfQuarter: quarter.monthNumbers[0] === m.month,
      lastOfQuarter: quarter.monthNumbers[2] === m.month,
      temp,
      crowd,
      smoky,
      wet,
      daylight: { text: `${m.daylight_hr.toFixed(1)} h`, state: 'none', note: `Sunrise ${m.sunrise}, sunset ${m.sunset}` },
      hazards,
    }
  })
}
