export type Part = 'transport' | 'lodging' | 'food' | 'activity' | 'buffer'
export const PART_LABEL: Record<Part, string> = { lodging: 'Lodging', food: 'Food', transport: 'Transport', activity: 'Park fees and permits', buffer: 'Buffer (15%)' }
/** Short names for direct labels on the bars. */
export const PART_SHORT: Record<Part, string> = { lodging: 'Lodging', food: 'Food', transport: 'Transport', activity: 'Fees', buffer: 'Buffer' }
/** Stack order, bottom to top (v2: the biggest part, getting there, at the base). */
export const PART_ORDER: Part[] = ['transport', 'lodging', 'food', 'activity', 'buffer']
/** Words for the direct labels beside the selected bar (v2). */
export const PART_DIRECT: Record<Part, string> = { transport: 'Transport', lodging: 'Lodging', food: 'Food', activity: 'Entry and permit', buffer: 'Buffer, 15%:' }

/** Words under a quarter label: "best and cheapest", "cheapest", "best fit" or nothing. */
export function quarterNote(q: number, cheapest: number | null, best: number | null): string {
  const t = quarterTags(q, cheapest, best).map((x) => x.kind)
  return t.length === 2 ? 'best and cheapest' : t[0] === 'cheapest' ? 'cheapest' : t[0] === 'best' ? 'best fit' : ''
}

/** Text height in px (12 px type), and the padding a label needs above and below. */
const LINE = 14
const PAD = 4
/** How much of a label fits inside a segment that is `h` px tall: name and amount, amount only, or nothing. */
export function labelMode(h: number): 'two' | 'one' | 'none' {
  if (h >= LINE * 2 + PAD * 2) return 'two'
  if (h >= LINE + PAD * 2) return 'one'
  return 'none'
}

export interface QuarterTag { kind: 'cheapest' | 'best'; text: string }
/** The direct annotations above a bar (each is shown with an icon and a word, never colour alone). */
export function quarterTags(q: number, cheapest: number | null, best: number | null): QuarterTag[] {
  const tags: QuarterTag[] = []
  if (q === cheapest) tags.push({ kind: 'cheapest', text: 'Cheapest' })
  if (q === best) tags.push({ kind: 'best', text: 'Best fit' })
  return tags
}

/** Words for the leader-line label of a slice too thin to hold its own text (one entry per line; the amount follows as the last line). */
export const PART_CALLOUT: Record<Part, string[]> = {
  lodging: ['Lodging'],
  food: ['Food'],
  transport: ['Transport'],
  activity: ['Fees and', 'permits'],
  buffer: ['Buffer'],
}
/** Height in px of a callout: one 14 px line per entry plus the amount. */
export const calloutHeight = (part: Part): number => (PART_CALLOUT[part].length + 1) * LINE

export interface CalloutIn { key: string; y: number; h: number }
/**
 * Places callout labels in one column so none overlaps: each wants to be centred on `y` (its slice), `gap` px apart at least, all inside [top, bottom].
 * Returns the top edge of each label by key. Labels keep their order from top to bottom.
 */
export function spreadCallouts(items: CalloutIn[], gap: number, top: number, bottom: number): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  const tops = sorted.map((i) => i.y - i.h / 2)
  for (let i = 0; i < sorted.length; i++) {
    const min = i === 0 ? top : tops[i - 1] + sorted[i - 1].h + gap
    if (tops[i] < min) tops[i] = min
  }
  // if the stack ran past the bottom, pull it back up
  for (let i = sorted.length - 1; i >= 0; i--) {
    const max = (i === sorted.length - 1 ? bottom : tops[i + 1] - gap) - sorted[i].h
    if (tops[i] > max) tops[i] = max
  }
  return new Map(sorted.map((it, i) => [it.key, tops[i]]))
}
