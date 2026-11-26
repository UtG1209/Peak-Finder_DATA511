// Stacked cost bars, Q1 to Q4 (CLAUDE.md "What it costs", v2 "How much"): transport, lodging, food, entry and permit, and a hatched 15% buffer.
// D3 scales, React SVG. Not a pie (the pie on the orange sticky note was rejected). The selected bar is outlined and its parts are labelled
// directly beside it (on a phone: in a list under the chart), no detached legend. Segments and quarter labels are buttons: Enter on a segment
// opens its line items, Esc closes, Left and Right on a quarter label step quarters. Colours come from tokens via CSS classes so they follow the theme.
import { useEffect, useId, useRef, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3'
import type { Quarter } from '../../data/schema'
import type { TripCost } from '../../models/cost'
import { usd } from '../../lib/money'
import { cheapestQuarter, lineName } from '../../lib/costWhatIf'
import { PART_DIRECT, PART_LABEL, PART_ORDER, PART_SHORT, quarterNote, spreadCallouts, type Part } from '../../lib/costParts'

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

const H = 300
const QUARTERS: Quarter[] = [1, 2, 3, 4]
/** Below this width the direct labels move out of the svg into a list under it. */
const WIDE = 560

/** Transport's second line: "flights $612, rental car $180". Only when the part has more than one line. */
const subline = (c: TripCost, part: Part) => {
  if (part === 'buffer') return ''
  const ls = c.lines[part].filter((l) => l.amount > 0)
  return ls.length > 1 ? ls.map((l) => `${lineName(l.label)} ${usd(l.amount)}`).join(', ') : ''
}

export function CostBars({ costs, selectedQuarter, bestQuarter, onSelectQuarter, onSelectPart, onClear, active }: CostBarsProps) {
  const uid = useId()
  // The viewBox follows the container width so text stays 12 px or more at any width (a fixed viewBox would shrink it on phones).
  const wrap = useRef<HTMLDivElement>(null)
  const qRefs = useRef<(SVGGElement | null)[]>([])
  const [W, setW] = useState(680)
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const wide = W >= WIDE
  const M = { top: 36, right: wide ? 220 : 8, bottom: 52, left: wide ? 64 : 48 }
  const max = Math.max(1, ...costs.map((c) => c?.total ?? 0))
  const cheapest = cheapestQuarter(costs)

  const x = scaleBand<number>().domain(QUARTERS).range([M.left, W - M.right]).paddingInner(0.28).paddingOuter(0.1)
  const y = scaleLinear().domain([0, max]).nice(3).range([H - M.bottom, M.top])
  const ticks = y.ticks(3)
  const bw = x.bandwidth()

  const selCost = costs[selectedQuarter - 1]
  // Direct labels for every part of the selected bar, in one column to its right, spread so none overlaps.
  const labels = (() => {
    if (!selCost || !wide) return []
    let acc = 0
    const items = PART_ORDER.flatMap((part) => {
      const v = selCost[part]
      const mid = y(acc + v / 2)
      acc += v
      if (v <= 0) return []
      const sub = subline(selCost, part)
      return [{ part, v, y: mid, sub, h: sub ? 30 : 16 }]
    })
    const tops = spreadCallouts(items.map((i) => ({ key: i.part, y: i.y, h: i.h })), 6, M.top - 8, H - M.bottom)
    return items.map((i) => ({ ...i, top: tops.get(i.part) ?? i.y }))
  })()
  const x1 = (x(selectedQuarter) ?? 0) + bw
  // the label column, right of the last bar; leaders from a non-last bar run behind the bars to its right
  const colX = W - M.right + 20

  const open = (q: Quarter, part: Part) => { onSelectQuarter(q); onSelectPart(q, part) }
  const stepQuarter = (q: Quarter, d: number) => {
    const n = Math.min(4, Math.max(1, q + d)) as Quarter
    if (n === q) return
    onSelectQuarter(n)
    qRefs.current[n - 1]?.focus()
  }

  return (
    <div ref={wrap} className="costwrap">
      <svg
        viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Typical trip cost for each quarter, stacked by part. Tab to a part and press Enter for its line items." className={`costbars${wide ? '' : ' narrow'}`}
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
            {t > 0 && <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="grid" />}
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis">{usd(t)}</text>
          </g>
        ))}
        {labels.map((l) => (
          <polyline key={l.part} className="leader" aria-hidden="true" fill="none" points={`${x1 + 2},${l.y} ${colX - 10},${l.y} ${colX - 4},${l.top + 8}`} />
        ))}
        {QUARTERS.map((q) => {
          const c = costs[q - 1]
          const bx = x(q) ?? 0
          const cx = bx + bw / 2
          const isSel = q === selectedQuarter
          const note = quarterNote(q, cheapest, bestQuarter)
          let acc = 0
          return (
            <g key={q} className={`qbar${isSel ? ' sel' : ''}`}>
              {c ? (
                <>
                  <g className="bar">
                    {PART_ORDER.map((part) => {
                      const v = c[part]
                      const y0 = y(acc)
                      const y1 = y(acc + v)
                      acc += v
                      const isActive = active?.q === q && active.part === part
                      return (
                        <g
                          key={part} role="button" tabIndex={0} className={`seg${isActive ? ' on' : ''}`} data-seg={`${q}-${part}`}
                          aria-label={`${PART_SHORT[part]} ${usd(v)}${part === 'activity' ? ' (park fees and permits)' : ''} in Q${q}. Show details.`}
                          aria-pressed={isActive}
                          onClick={() => open(q, part)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(q, part) } }}
                        >
                          <rect x={bx} y={y1} width={bw} height={Math.max(0, y0 - y1)} className={`fill p-${part}`} fill={part === 'buffer' ? `url(#${uid}-hatch)` : undefined} />
                        </g>
                      )
                    })}
                  </g>
                  {isSel && <rect x={bx - 1} y={y(c.total) - 1} width={bw + 2} height={y(0) - y(c.total) + 2} className="outline" />}
                  <text x={cx} y={y(c.total) - 8} textAnchor="middle" className="total">{usd(c.total)}</text>
                </>
              ) : (
                <text x={cx} y={H - M.bottom - 10} textAnchor="middle" className="axis">No cost data</text>
              )}
              <g
                ref={(el) => { qRefs.current[q - 1] = el }}
                role="button" tabIndex={0} aria-pressed={isSel}
                className="qlabel" onClick={() => onSelectQuarter(q)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectQuarter(q) }
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stepQuarter(q, e.key === 'ArrowRight' ? 1 : -1) }
                }}
              >
                <rect x={bx - 6} y={H - M.bottom + 4} width={bw + 12} height={46} rx={4} className="hit" />
                <text x={cx} y={H - M.bottom + 20} textAnchor="middle" className="qn">{isSel && wide ? `Q${q} selected` : `Q${q}`}</text>
                {note && <text x={cx} y={H - M.bottom + 37} textAnchor="middle" className="qnote">{note}</text>}
              </g>
            </g>
          )
        })}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="base" />
        {labels.map((l) => (
          <g key={l.part} className="direct" aria-hidden="true">
            <text x={colX} y={l.top + 8} dy="0.32em" className={`dl${l.part === 'transport' ? ' big' : ''}`}>{PART_DIRECT[l.part]} {usd(l.v)}</text>
            {l.sub && <text x={colX} y={l.top + 24} dy="0.32em" className="dsub">{l.sub}</text>}
          </g>
        ))}
      </svg>
      {!wide && selCost && (
        <ul className="costleg" aria-label={`Parts of the Q${selectedQuarter} bar`}>
          {[...PART_ORDER].reverse().map((part) => selCost[part] > 0 && (
            <li key={part}>
              <button type="button" onClick={() => open(selectedQuarter, part)} aria-pressed={active?.q === selectedQuarter && active.part === part}>
                <i className={`sw p-${part}`} aria-hidden="true" />
                <span>{PART_DIRECT[part].replace(/:$/, '')}{subline(selCost, part) ? `: ${subline(selCost, part)}` : ''}</span>
                <b>{usd(selCost[part])}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sr-only"><table>
        <caption>Typical cost by quarter, from past data</caption>
        <thead><tr><th scope="col">Quarter</th>{PART_ORDER.map((p) => <th key={p} scope="col">{PART_LABEL[p]}</th>)}<th scope="col">Total</th></tr></thead>
        <tbody>
          {QUARTERS.map((q) => {
            const c = costs[q - 1]
            return (
              <tr key={q}><th scope="row">Q{q}</th>{c ? <>{PART_ORDER.map((p) => <td key={p}>{usd(c[p])}</td>)}<td>{usd(c.total)}</td></> : <td colSpan={PART_ORDER.length + 1}>No cost data</td>}</tr>
            )
          })}
        </tbody>
      </table></div>
    </div>
  )
}
