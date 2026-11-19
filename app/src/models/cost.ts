// Typical trip cost (CLAUDE.md section 5). Pure function; the browser applies party size,
// nights and mode live to the unit inputs in cost.json.
import type { CostRow, Travel } from '../data/schema'

export type TravelMode = 'fly' | 'drive'

export const BUFFER_RATE = 0.15 // hatched buffer on top: the "unexpected" share
export const LODGING_TAX = 1.12
export const ANNUAL_PASS = 80 // entry fees are capped at the America the Beautiful pass price

export interface TripParams {
  travellers: number
  nights: number
  mode: TravelMode
}

export interface CostLine {
  label: string
  amount: number
  /** Source key in CostRow.sources for the popover. */
  source: 'fare' | 'lodging' | 'gas' | 'fees' | 'assumed'
}

export interface TripCost {
  transport: number
  lodging: number
  food: number
  activity: number
  buffer: number
  total: number
  lines: Record<'transport' | 'lodging' | 'food' | 'activity', CostLine[]>
}

/** Default mode = whichever is the shorter door to trailhead (cost.json has no mode, travel.json does). */
export const defaultMode = (t: Travel | null): TravelMode => t?.default_mode ?? 'fly'

export function tripCost(row: CostRow, p: TripParams): TripCost {
  const travellers = Math.max(1, Math.floor(p.travellers))
  const nights = Math.max(0, Math.floor(p.nights))
  const vehicles = Math.ceil(travellers / 4)
  const rooms = Math.ceil(travellers / 2)

  const transportLines: CostLine[] =
    p.mode === 'fly'
      ? [
          { label: `Flights (${travellers} × 2 × $${row.fare_one_way.toFixed(2)})`, amount: row.fare_one_way * 2 * travellers, source: 'fare' },
          { label: `Rental car ($${row.car_per_day}/day × ${nights + 1} days, assumed)`, amount: row.car_per_day * (nights + 1), source: 'assumed' },
        ]
      : [{ label: `Gas (${row.drive_mi * 2} mi at ${row.mpg} mpg, ${vehicles} vehicle${vehicles > 1 ? 's' : ''})`, amount: ((row.drive_mi * 2) / row.mpg) * row.gas_per_gal * vehicles, source: 'gas' }]
  const lodgingLines: CostLine[] = [
    { label: `Lodging ($${row.lodging_per_night} × ${nights} nights × ${rooms} room${rooms > 1 ? 's' : ''}, incl. 12% tax)`, amount: row.lodging_per_night * nights * rooms * LODGING_TAX, source: 'lodging' },
  ]
  const foodLines: CostLine[] = [
    { label: `Meals ($${row.meals_per_day}/day × ${nights + 0.5} days × ${travellers})`, amount: row.meals_per_day * (nights + 0.5) * travellers, source: 'lodging' },
  ]
  const entry = Math.min(row.entry_fee_vehicle * vehicles, ANNUAL_PASS)
  const activityLines: CostLine[] = [{ label: `Park entry (${vehicles} vehicle${vehicles > 1 ? 's' : ''}, capped at $${ANNUAL_PASS})`, amount: entry, source: 'fees' }]
  if (row.permit_fee > 0) activityLines.push({ label: 'Permit (per party)', amount: row.permit_fee, source: 'fees' })

  const total4 = (ls: CostLine[]) => ls.reduce((s, l) => s + l.amount, 0)
  const transport = total4(transportLines)
  const lodging = total4(lodgingLines)
  const food = total4(foodLines)
  const activity = total4(activityLines)
  const subtotal = transport + lodging + food + activity
  const buffer = subtotal * BUFFER_RATE
  return {
    transport,
    lodging,
    food,
    activity,
    buffer,
    total: subtotal + buffer,
    lines: { transport: transportLines, lodging: lodgingLines, food: foodLines, activity: activityLines },
  }
}
