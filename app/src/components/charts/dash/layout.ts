// Pure layout and data helpers for the linked dashboard panels (3D view). Kept free of React so they are unit-tested.
import { scaleBand, scaleLinear } from 'd3'
import type { HikeMonth } from '../../../data/schema'

export interface Bar { key: number; x: number; y: number; w: number; h: number; value: number }

/** Vertical bars for `values` (index 0 = first key), inside a box with margins. Heights follow `max` (default: the largest value, at least 1). */
export function barLayout(values: (number | null)[], box: { width: number; height: number; left: number; right: number; top: number; bottom: number }, max?: number, pad = 0.3): Bar[] {
  const top = Math.max(1, max ?? Math.max(1, ...values.map((v) => v ?? 0)))
  const x = scaleBand<number>().domain(values.map((_, i) => i)).range([box.left, box.width - box.right]).padding(pad)
  const y = scaleLinear().domain([0, top]).range([box.height - box.bottom, box.top])
  return values.map((v, i) => {
    const val = Math.max(0, Math.min(top, v ?? 0))
    const yy = y(val)
    return { key: i, x: x(i) ?? 0, y: yy, w: x.bandwidth(), h: box.height - box.bottom - yy, value: v ?? 0 }
  })
}

export interface MonthPoint { month: number; crowd: number | null; smoky: number | null }

/** Twelve month entries (Jan..Dec) of crowd level (0..1 of the busiest month) and typical smoky days. Missing data stays null. */
export function monthSeries(months: HikeMonth[]): MonthPoint[] {
  const by = new Map(months.map((m) => [m.month, m]))
  return Array.from({ length: 12 }, (_, i) => {
    const m = by.get(i + 1)
    return {
      month: i + 1,
      crowd: m && !m.missing.includes('crowd') ? m.crowd_level : null,
      smoky: m && !m.missing.includes('smoky') ? m.smoky_days : null,
    }
  })
}
