/** The selection bar's month arrows: whole quarter (null), then its three months, then back to the whole quarter. */
export function stepMonth(months: readonly number[], current: number | null, dir: 1 | -1): number | null {
  const order: (number | null)[] = [null, ...months]
  const i = Math.max(0, order.indexOf(current))
  return order[(i + dir + order.length) % order.length]
}
