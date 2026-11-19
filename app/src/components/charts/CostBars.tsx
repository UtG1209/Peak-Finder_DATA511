// Stacked cost bars, Q1 to Q4 (CLAUDE.md "What it costs"): lodging, food, transport, activity and a hatched 15% buffer.
// D3 scales, React SVG. Not a pie (the pie on the orange sticky note was rejected). Click a segment for its line items and source.
import { useId, useMemo } from 'react'
import { scaleBand, scaleLinear } from 'd3'
import type { Quarter } from '../../data/schema'
import type { TripCost } from '../../models/cost'
import { usd } from '../../lib/money'
import { PART_LABEL, type Part } from '../../lib/costParts'

// bottom to top. Muted neutrals so they never read as difficulty colours.
const ORDER: Part[] = ['lodging', 'food', 'transport', 'activity', 'buffer']
const FILL: Record<Part, string> = { lodging: '#8fb8c9', food: '#c9b79c', transport: '#9aa7d6', activity: '#7fb59f', buffer: '#3b4752' }

export interface CostBarsProps {
  /** One TripCost per quarter, index 0 = Q1. null when the cost row is missing. */
  costs: (TripCost | null)[]
  selectedQuarter: Quarter
  bestQuarter: Quarter | null
  onSelectQuarter: (q: Quarter) => void
  onSelectPart: (q: Quarter, part: Part) => void
  active: { q: Quarter; part: Part } | null
}

const W = 640
const H = 330
const M = { top: 34, right: 12, bottom: 34, left: 52 }

export function CostBars({ costs, selectedQuarter, bestQuarter, onSelectQuarter, onSelectPart, active }: CostBarsProps) {
  const uid = useId()
  const totals = costs.map((c) => c?.total ?? 0)
  const max = Math.max(1, ...totals)
  const cheapest = useMemo(() => {
    let idx = -1
    costs.forEach((c, i) => {
      if (c && (idx === -1 || c.total < (costs[idx]?.total ?? Infinity))) idx = i
    })
    return idx === -1 ? null : ((idx + 1) as Quarter)
  }, [costs])

  const x = scaleBand<number>().domain([1, 2, 3, 4]).range([M.left, W - M.right]).padding(0.3)
  const y = scaleLinear().domain([0, max]).nice().range([H - M.bottom, M.top])
  const ticks = y.ticks(5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Typical trip cost for each quarter, stacked by part" className="costbars">
      <defs>
        <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="#232d35" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#8a97a2" strokeWidth="2.5" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#2a333b" />
          <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis">{usd(t)}</text>
        </g>
      ))}
      {([1, 2, 3, 4] as Quarter[]).map((q) => {
        const c = costs[q - 1]
        const bx = x(q) ?? 0
        const bw = x.bandwidth()
        const dim = q !== selectedQuarter
        let acc = 0
        return (
          <g key={q} opacity={dim ? 0.72 : 1}>
            {c ? (
              <>
                {ORDER.map((part) => {
                  const v = c[part]
                  const y0 = y(acc)
                  const y1 = y(acc + v)
                  acc += v
                  const isActive = active?.q === q && active.part === part
                  return (
                    <g
                      key={part} role="button" tabIndex={0} className="seg"
                      aria-label={`${PART_LABEL[part]}, Q${q}: ${usd(v)}. Show details.`}
                      onClick={() => { onSelectQuarter(q); onSelectPart(q, part) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectQuarter(q); onSelectPart(q, part) } }}
                    >
                      <rect x={bx} y={y1} width={bw} height={Math.max(0, y0 - y1)} fill={part === 'buffer' ? `url(#${uid}-hatch)` : FILL[part]} stroke={isActive ? '#fff' : '#101418'} strokeWidth={isActive ? 2 : 1} />
                      {y0 - y1 > 22 && part !== 'buffer' && <text x={bx + bw / 2} y={(y0 + y1) / 2} dy="0.32em" textAnchor="middle" className="seglabel">{usd(v)}</text>}
                    </g>
                  )
                })}
                <text x={bx + bw / 2} y={y(c.total) - 18} textAnchor="middle" className="total">{usd(c.total)}</text>
                {(q === cheapest || q === bestQuarter) && (
                  <text x={bx + bw / 2} y={y(c.total) - 5} textAnchor="middle" className="tagline">
                    {q === cheapest && q === bestQuarter ? 'Cheapest · Best fit' : q === cheapest ? 'Cheapest' : 'Best fit'}
                  </text>
                )}
              </>
            ) : (
              <text x={bx + bw / 2} y={H - M.bottom - 8} textAnchor="middle" className="axis">No cost data</text>
            )}
            <text
              x={bx + bw / 2} y={H - 10} textAnchor="middle" className={`qlabel${q === selectedQuarter ? ' sel' : ''}`}
              role="button" tabIndex={0} onClick={() => onSelectQuarter(q)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectQuarter(q) }}
            >{`Q${q}`}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function CostLegend() {
  return (
    <ul className="costlegend">
      {ORDER.map((p) => (
        <li key={p}>
          <i className={p === 'buffer' ? 'hatch' : ''} style={p === 'buffer' ? undefined : { background: FILL[p] }} />
          {PART_LABEL[p]}
        </li>
      ))}
    </ul>
  )
}
