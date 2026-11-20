// FLIP re-sort helper: given each row's top offset before and after a re-order, return how far (px) each row has to be
// moved back so it can slide into its new place. Pure, so it is unit-tested; the DOM part lives in Explore.tsx.
// Rows that did not move (or that only exist on one side) are left out, so nothing animates for no reason.

export type Tops = ReadonlyMap<string, number>

/** id -> pixels to translate from (old position - new position). Moves smaller than `minPx` are ignored. */
export function flipDeltas(before: Tops, after: Tops, minPx = 1): Map<string, number> {
  const out = new Map<string, number>()
  for (const [id, top] of after) {
    const prev = before.get(id)
    if (prev === undefined) continue
    const d = prev - top
    if (Math.abs(d) >= minPx) out.set(id, d)
  }
  return out
}

/** Duration of the slide, ms. Matches --dur (200) .. --dur-slow (400) in tokens.css; one fixed value so it reads as one motion. */
export const FLIP_MS = 250
export const FLIP_EASE = 'cubic-bezier(0.2, 0, 0, 1)' // same curve as --ease in tokens.css
