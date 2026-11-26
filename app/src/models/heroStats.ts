// The three ruled numbers in the Hike page hero (v2): best quarter, how well it fits, the typical trip. Pure text from numbers the page already has.
import { usd } from '../lib/money'

export interface HeroStatsInput {
  /** Match 0..100 for Q1..Q4. */
  matches: number[]
  /** Trip total for Q1..Q4, null when no home city. */
  costs: (number | null)[]
  /** The best quarter (1..4), already tie-broken by cost. */
  best: number
  anyLimit: boolean
}

export interface HeroStats {
  /** Rounded match of the best quarter, or null when no limit is set (never "100%" as a hero claim). */
  bestMatch: number | null
  /** The line under the match: other quarters that tie, or the runner-up. */
  tieNote: string | null
  /** Typical trip total for the best quarter and a short line, or null with no home city. */
  trip: { total: number; note: string } | null
}

const names = (qs: number[]) => {
  const n = qs.map((q) => `Q${q}`)
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

export function heroStats({ matches, costs, best, anyLimit }: HeroStatsInput): HeroStats {
  const score = Math.round(matches[best - 1])
  const others = [1, 2, 3, 4].filter((q) => q !== best)
  const tied = anyLimit ? others.filter((q) => Math.round(matches[q - 1]) === score) : []

  const runnerUp = others.reduce((a, b) => (matches[b - 1] > matches[a - 1] ? b : a))
  const tieNote = !anyLimit
    ? 'Set limits on the map to score quarters'
    : tied.length
      ? `${names(tied)} also ${score}%`
      : `Next best Q${runnerUp}, ${Math.round(matches[runnerUp - 1])}%`

  const total = costs[best - 1]
  let trip: HeroStats['trip'] = null
  if (total != null) {
    // among the quarters that tie (all four when no limit is set), the gap to the next cheapest one is the tie-break
    const rivals = (anyLimit ? tied : others).filter((q) => costs[q - 1] != null)
    const next = rivals.reduce<number | null>((a, q) => (a == null || costs[q - 1]! < costs[a - 1]! ? q : a), null)
    const gap = next == null ? null : costs[next - 1]! - total
    let note = 'Typical, from past data'
    if (gap != null && gap >= 0 && rivals.length) {
      note = anyLimit ? `${usd(gap)} under Q${next}, the tie-break` : 'The cheapest quarter'
    } else if (costs.every((c) => c == null || c >= total)) note = 'The cheapest quarter'
    trip = { total, note }
  }
  return { bestMatch: anyLimit ? score : null, tieNote, trip }
}
