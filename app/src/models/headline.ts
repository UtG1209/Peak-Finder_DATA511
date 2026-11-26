// The one answer sentence at the top of the Hike page (Plan 5b, design decision 1).
// One winner, a tie, or no limits set: never says "100%" as a headline. Pure text from numbers the page already has.
import { usd } from '../lib/money'

export interface HeadlineInput {
  /** Match 0..100 for Q1..Q4. */
  matches: number[]
  /** Trip total for Q1..Q4, null when no home city. */
  costs: (number | null)[]
  /** The best quarter (1..4), already tie-broken by cost in `bestQuarter`. */
  best: number
  /** At least one limit is set (a slider is not on "Any"). */
  anyLimit: boolean
  /** Typical high of the best quarter, already formatted with units, or null when missing. */
  high: string | null
  /** Smoky days of the best quarter, or null when missing. */
  smoky: number | null
  /** Home city name for "from Seattle", or null. */
  city: string | null
}

const list = (qs: number[]) => {
  const names = qs.map((q) => `Q${q}`)
  return names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function headline(h: HeadlineInput): string {
  const q = `Q${h.best}`
  const cost = h.costs[h.best - 1]
  const about = cost != null ? `about ${usd(cost)}${h.city ? ` from ${h.city}` : ''}` : null
  const cheapest = cost != null && h.costs.every((c) => c == null || c >= cost)
  if (!h.anyLimit) {
    return about && cheapest
      ? `No limits set. Here is the typical year: ${q} is the cheapest, ${about}.`
      : 'No limits set. Set your limits to see which quarter fits you.'
  }
  const score = Math.round(h.matches[h.best - 1])
  const tied = [1, 2, 3, 4].filter((n) => Math.round(h.matches[n - 1]) === score)
  if (tied.length > 1) {
    const fit = score >= 100 ? 'fit your limits' : `fit equally well (${score}%)`
    const cheapestOfTied = cost != null && tied.every((n) => h.costs[n - 1] == null || (h.costs[n - 1] as number) >= cost)
    return `${list(tied)} ${fit}.${about && cheapestOfTied ? ` ${q} is the cheapest of them, at ${about}.` : ''}`
  }
  const parts = [
    h.high ? `typical high ${h.high}` : null,
    h.smoky == null ? null : h.smoky === 0 ? 'no smoky days' : `${Math.round(h.smoky)} smoky ${Math.round(h.smoky) === 1 ? 'day' : 'days'}`,
    about,
  ].filter(Boolean)
  return `${q} fits ${score}%${parts.length ? `: ${parts.join(', ')}` : ''}.`
}
