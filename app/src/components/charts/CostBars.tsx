// Stacked cost bars, Q1 to Q4 (CLAUDE.md "What it costs"): lodging, food, transport, activity and a hatched 15% buffer.
// D3 scales, React SVG. Not a pie (the pie on the orange sticky note was rejected). The selected bar is labelled directly (no legend);
// click or press Enter on a segment for its line items and source, Esc closes. Colours come from tokens via CSS classes so they follow the theme.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3'
import type { Quarter } from '../../data/schema'
import type { TripCost } from '../../models/cost'
import { Icon } from '../Icon'
import { usd } from '../../lib/money'
import { PART_CALLOUT, PART_LABEL, PART_ORDER, PART_SHORT, calloutHeight, labelMode, quarterTags, spreadCallouts, type Part } from '../../lib/costParts'

export interface CostBarsProps {
  /** One TripCost per quarter, index 0 = Q1. null when the cost row is missing. */
  costs: (TripCost | null)[]
  selectedQuarter: Quarter
  bestQuarter: Quarter | null
  onSelectQuarter: (q: Quarter) => void
  onSelectPart: (q: Quarter, part: Part) => void
  /** Called on Esc to close the open detail. */
  onClear?: () => void
  active: { q: Quarter; part: Part } | null
}

const H = 348
// right = the column where thin slices of the selected bar get a leader-line label
const M = { top: 72, right: 76, bottom: 52, left: 56 }
const QUARTERS: Quarter[] = [1, 2, 3, 4]

export function CostBars({ costs, selectedQuarter, bestQuarter, onSelectQuarter, onSelectPart, onClear, active }: CostBarsProps) {
  const uid = useId()
  // The viewBox follows the container width so text stays 12 px or more at any width (a fixed viewBox would shrink it on phones).
  const wrap = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const totals = costs.map((c) => c?.total ?? 0)
  const max = Math.max(1, ...totals)
  const cheapest = useMemo(() => {
    let idx = -1
    costs.forEach((c, i) => {
      if (c && (idx === -1 || c.total < (costs[idx]?.total ?? Infinity))) idx = i
    })
    return idx === -1 ? null : ((idx + 1) as Quarter)
  }, [costs])

  const x = scaleBand<number>().domain(QUARTERS).range([M.left, W - M.right]).padding(0.2)
  const y = scaleLinear().domain([0, max]).nice().range([H - M.bottom, M.top])
  const ticks = y.ticks(4).filter((t) => t > 0)

  // Slices of the selected bar too thin to hold text are named in the right-hand column, joined by a thin line that runs behind the other bars.
  const callouts = (() => {
    const c = costs[selectedQuarter - 1]
    if (!c) return []
    const items: { part: Part; v: number; y: number; h: number }[] = []
    let acc = 0
    for (const part of PART_ORDER) {
      const v = c[part]
      const y0 = y(acc), y1 = y(acc + v)
      acc += v
      if (v > 0 && labelMode(Math.max(0, y0 - y1)) === 'none') items.push({ part, v, y: (y0 + y1) / 2, h: calloutHeight(part) })
    }
    const tops = spreadCallouts(items.map((i) => ({ key: i.part, y: i.y, h: i.h })), 6, M.top - 24, H - M.bottom)
    return items.map((i) => ({ ...i, top: tops.get(i.part) ?? i.y }))
  })()

  return (
    <div ref={wrap} className="costwrap">
      <svg
        viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Typical trip cost for each quarter, stacked by part. Tab to a part and press Enter for its line items." className={`costbars${W < 480 ? ' narrow' : ''}`}
        onKeyDown={(e) => { if (e.key === 'Escape' && active) { e.stopPropagation(); onClear?.() } }}
      >
        <defs>
          <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2" className="hatch-line" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis">{usd(t)}</text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="base" />
        {callouts.map((c) => {
          const x0 = (x(selectedQuarter) ?? 0) + x.bandwidth()
          return <polyline key={c.part} className="leader" fill="none" points={`${x0},${c.y} ${W - M.right + 8},${c.y} ${W - M.right + 14},${c.top + 7}`} />
        })}
        {QUARTERS.map((q) => {
          const c = costs[q - 1]
          const bx = x(q) ?? 0
          const bw = x.bandwidth()
          const cx = bx + bw / 2
          const isSel = q === selectedQuarter
          const tags = quarterTags(q, cheapest, bestQuarter)
          let acc = 0
          return (
            <g key={q} className={`qbar${isSel ? ' sel' : ''}`}>
              {c ? (
                <>
                  {PART_ORDER.map((part) => {
                    const v = c[part]
                    const y0 = y(acc)
                    const y1 = y(acc + v)
                    acc += v
                    const h = Math.max(0, y0 - y1)
                    const isActive = active?.q === q && active.part === part
                    const raw = isSel ? labelMode(h) : 'none'
                    const mode = raw === 'two' && bw < 80 ? 'one' : raw
                    const mid = (y0 + y1) / 2
                    const open = () => { onSelectQuarter(q); onSelectPart(q, part) }
                    return (
                      <g
                        key={part} role="button" tabIndex={0} className={`seg${isActive ? ' on' : ''}`}
                        aria-label={`${PART_SHORT[part]} ${usd(v)}${part === 'activity' ? ' (park fees and permits)' : ''} in Q${q}. Show details.`}
                        aria-pressed={isActive}
                        onClick={open}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
                      >
                        <rect x={bx} y={y1} width={bw} height={h} className={`fill p-${part}`} fill={part === 'buffer' ? `url(#${uid}-hatch)` : undefined} />
                        {mode !== 'none' && (
                          <g className={`seglabel p-${part}`}>
                            {part === 'buffer' && <rect x={cx - 34} y={mid - (mode === 'two' ? 16 : 9)} width={68} height={mode === 'two' ? 32 : 18} rx={2} className="plate" />}
                            {mode === 'two' && <text x={cx} y={mid - 7} dy="0.32em" textAnchor="middle" className="nm">{PART_SHORT[part]}</text>}
                            <text x={cx} y={mode === 'two' ? mid + 8 : mid} dy="0.32em" textAnchor="middle" className="amt">{usd(v)}</text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                  <text x={cx} y={y(c.total) - 8} textAnchor="middle" className="total">{usd(c.total)}</text>
                  {tags.map((t, i) => {
                    const w = t.text.length * 6.4
                    const ty = y(c.total) - 40 - (tags.length - 1 - i) * 16
                    return (
                      <g key={t.kind} className={`tag ${t.kind}`}>
                        <g transform={`translate(${cx - w / 2 - 10}, ${ty - 7})`}><Icon name={t.kind === 'cheapest' ? 'check' : 'peak'} size={14} /></g>
                        <text x={cx + 9} y={ty} textAnchor="middle" dy="0.32em">{t.text}</text>
                      </g>
                    )
                  })}
                </>
              ) : (
                <text x={cx} y={H - M.bottom - 10} textAnchor="middle" className="axis">No cost data</text>
              )}
              <g
                role="button" tabIndex={0} aria-pressed={isSel} aria-label={`Q${q}${c ? `, typical ${usd(c.total)}` : ', no cost data'}`}
                className="qlabel" onClick={() => onSelectQuarter(q)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectQuarter(q) } }}
              >
                <rect x={bx} y={H - M.bottom + 4} width={bw} height={44} rx={4} className="hit" />
                <text x={cx} y={H - M.bottom + 26} textAnchor="middle" dy="0.32em">{`Q${q}`}</text>
                {isSel && <rect x={bx} y={H - M.bottom + 1} width={bw} height={3} className="mark" />}
              </g>
            </g>
          )
        })}
        {callouts.map((c) => (
          <text key={c.part} className="callout" aria-hidden="true" x={W - M.right + 18} y={c.top + 7}>
            {[...PART_CALLOUT[c.part], usd(c.v)].map((line, i, all) => (
              <tspan key={i} x={W - M.right + 18} dy={i === 0 ? '0.32em' : 14} className={i === all.length - 1 ? 'amt' : 'nm'}>{line}</tspan>
            ))}
          </text>
        ))}
      </svg>
      <ul className="sr-only" aria-label="Typical cost by quarter">
        {QUARTERS.map((q) => {
          const c = costs[q - 1]
          return <li key={q}>{c ? `Q${q}: ${usd(c.total)} in total. ${PART_ORDER.map((p) => `${PART_LABEL[p]} ${usd(c[p])}`).join(', ')}.` : `Q${q}: no cost data.`}</li>
        })}
      </ul>
    </div>
  )
}
