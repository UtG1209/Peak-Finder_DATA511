import type { Quarter } from '../data/schema'

// Q1 = Jan-Mar = Winter on every screen, including the 3D walk (UX rule 7).
export const QUARTERS: { q: Quarter; label: string; months: string; season: 'winter' | 'spring' | 'summer' | 'autumn'; monthNumbers: [number, number, number] }[] = [
  { q: 1, label: 'Q1', months: 'Jan–Mar', season: 'winter', monthNumbers: [1, 2, 3] },
  { q: 2, label: 'Q2', months: 'Apr–Jun', season: 'spring', monthNumbers: [4, 5, 6] },
  { q: 3, label: 'Q3', months: 'Jul–Sep', season: 'summer', monthNumbers: [7, 8, 9] },
  { q: 4, label: 'Q4', months: 'Oct–Dec', season: 'autumn', monthNumbers: [10, 11, 12] },
]

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const quarterOfMonth = (month: number): Quarter => (Math.ceil(month / 3) as Quarter)

/** Default quarter on arrival = the next quarter after today. */
export function defaultQuarter(today: Date = new Date()): Quarter {
  const current = quarterOfMonth(today.getMonth() + 1)
  return ((current % 4) + 1) as Quarter
}
