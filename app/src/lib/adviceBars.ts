// Which "Advice vs data" numbers can share one bar chart: 2 to 4 values of the same kind
// (all shares 0..1, or all counts, and the same unit in brackets), e.g. {"2010": 0.446, "2023": 0.766}.
// A mean temperature next to a day count is not comparable: then the card shows the finding text alone.
const unit = (key: string) => /\(([^)]+)\)\s*$/.exec(key)?.[1] ?? ''

export function comparableBars(numbers: Record<string, number>): [string, number][] | null {
  const entries = Object.entries(numbers)
  if (entries.length < 2 || entries.length > 4) return null
  const shares = entries.every(([, v]) => v >= 0 && v <= 1)
  const counts = entries.every(([, v]) => v > 1)
  if (!shares && !counts) return null
  if (new Set(entries.map(([k]) => unit(k))).size > 1) return null
  return entries
}

/** 0.446 -> "44.6%" (a share); 564036 -> "564,036". */
export const fmtAdviceNumber = (v: number) => (v <= 1 ? `${Math.round(v * 1000) / 10}%` : v.toLocaleString('en-US'))
