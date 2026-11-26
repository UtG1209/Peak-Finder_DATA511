// Words for the "How much" block (v2): the answer sentence, the biggest part, and the live "What if" deltas.
// Pure; every number comes from models/cost.ts tripCost, nothing is estimated here.
import type { CostRow, Quarter, Travel } from '../data/schema'
import { tripCost, type TravelMode, type TripCost, type TripParams } from '../models/cost'
import { usd } from './money'

const PARTS = ['transport', 'lodging', 'food', 'activity'] as const
const PART_WORDS: Record<(typeof PARTS)[number], string> = { transport: 'Getting there', lodging: 'Lodging', food: 'Food', activity: 'Entry and permit' }

/** "Flights (1 × 2 × $306.16)" -> "flights": the line's name without its arithmetic. */
export const lineName = (label: string) => label.split(' (')[0].toLowerCase()

/** The cheapest quarter with data, or null. */
export function cheapestQuarter(costs: (TripCost | null)[]): Quarter | null {
  let best = -1
  costs.forEach((c, i) => { if (c && (best === -1 || c.total < costs[best]!.total)) best = i })
  return best === -1 ? null : ((best + 1) as Quarter)
}

/** Heading and answer line: "About $1,437 in Q4, the cheapest quarter" and "Getting there is 55% of it: flights $612 and rental car $180." */
export function costAnswer(costs: (TripCost | null)[], q: Quarter): { title: string; detail: string } | null {
  const c = costs[q - 1]
  if (!c) return null
  const cheap = cheapestQuarter(costs)
  const title = cheap === q
    ? `About ${usd(c.total)} in Q${q}, the cheapest quarter`
    : `About ${usd(c.total)} in Q${q}, ${usd(c.total - costs[cheap! - 1]!.total)} more than Q${cheap}`
  const big = PARTS.reduce((a, p) => (c[p] > c[a] ? p : a), PARTS[0])
  const pct = Math.round((c[big] / c.total) * 100)
  const lines = c.lines[big].filter((l) => l.amount > 0)
  const detail = lines.length > 1
    ? `${PART_WORDS[big]} is ${pct}% of it: ${lines.map((l) => `${lineName(l.label)} ${usd(l.amount)}`).join(' and ')}.`
    : `${PART_WORDS[big]} is ${pct}% of it, ${usd(c[big])}.`
  return { title, detail }
}

export interface Delta { key: string; label: string; value: string; note?: string }

const hours = (t: Travel | null, m: TravelMode) => (t ? (m === 'fly' ? t.fly_drive_hr : t.drive_hr) : null)

/** The "What if" lines for the current inputs: one more night, the other travel mode, one more traveller. Only the ones that apply. */
export function whatIf(row: CostRow, p: TripParams, travel: Travel | null, max = { travellers: 12, nights: 21 }): Delta[] {
  const base = tripCost(row, p).total
  const out: Delta[] = []
  if (p.nights < max.nights) {
    const d = tripCost(row, { ...p, nights: p.nights + 1 }).total - base
    out.push({ key: 'night', label: 'One more night', value: `+${usd(d)}` })
  }
  const other: TravelMode = p.mode === 'fly' ? 'drive' : 'fly'
  const alt = tripCost(row, { ...p, mode: other }).total
  const diff = alt - base
  const hNow = hours(travel, p.mode), hAlt = hours(travel, other)
  let note = `${usd(Math.abs(diff))} ${diff <= 0 ? 'less' : 'more'}`
  if (hNow != null && hAlt != null) {
    // "but" when the cheaper choice is also slower (or the dearer one faster): a trade-off, not a win
    const tradeOff = (diff <= 0) === (hAlt > hNow)
    note += `, ${tradeOff ? 'but' : 'and'} ${hAlt.toFixed(1)} h each way instead of ${hNow.toFixed(1)} h`
  }
  out.push({ key: 'mode', label: other === 'drive' ? 'Drive instead' : 'Fly instead', value: usd(alt), note: `${note}.` })
  if (p.travellers < max.travellers) {
    const n = p.travellers + 1
    const t = tripCost(row, { ...p, travellers: n }).total
    out.push({
      key: 'traveller', label: n === 2 ? 'Two travellers' : `${n} travellers`, value: usd(t),
      note: `${usd(t / n)} each${n === 2 ? `: rooms and ${p.mode === 'fly' ? 'car' : 'gas'} are shared` : ''}.`,
    })
  }
  return out
}
