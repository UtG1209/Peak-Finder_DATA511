// Four bars: the selected hike's match % in each quarter (3D view dashboard). D3 scales, React SVG, like CostBars.
import type { Quarter } from '../../../data/schema'
import { barLayout } from './layout'

interface Props {
  hikeName: string
  /** match % for Q1..Q4 */
  matches: number[]
  selectedQuarter: Quarter
}

const W = 260
const H = 150
const BOX = { width: W, height: H, left: 38, right: 8, top: 22, bottom: 24 }

export function QuarterMatch({ hikeName, matches, selectedQuarter }: Props) {
  const bars = barLayout(matches, BOX, 100)
  const text = matches.map((m, i) => `Q${i + 1} ${Math.round(m)} percent`).join(', ')
  return (
    <figure className="dash-card">
      <figcaption>Match by quarter</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${hikeName}: match with your limits by quarter, typical past years. ${text}.`}>
        {[0, 50, 100].map((t) => {
          const y = BOX.top + (1 - t / 100) * (H - BOX.top - BOX.bottom)
          return (
            <g key={t}>
              <line x1={BOX.left} x2={W - BOX.right} y1={y} y2={y} className="dash-grid" />
              <text x={BOX.left - 5} y={y} dy="0.32em" textAnchor="end" className="dash-axis">{t}%</text>
            </g>
          )
        })}
        {bars.map((b) => (
          <g key={b.key}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} className={b.key + 1 === selectedQuarter ? 'dash-bar sel' : 'dash-bar'} />
            <text x={b.x + b.w / 2} y={b.y - 5} textAnchor="middle" className="dash-val">{Math.round(b.value)}%</text>
            <text x={b.x + b.w / 2} y={H - 8} textAnchor="middle" className={b.key + 1 === selectedQuarter ? 'dash-axis sel' : 'dash-axis'}>Q{b.key + 1}</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
