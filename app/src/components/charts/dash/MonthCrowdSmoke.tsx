// Twelve months for the selected hike: crowd level (share of the park's busiest month) on top, typical smoky days below.
// The chosen quarter's three months are framed. D3 scales, React SVG.
import type { HikeMonth, Quarter } from '../../../data/schema'
import { barLayout, monthSeries } from './layout'

interface Props {
  hikeName: string
  months: HikeMonth[] // all 12
  selectedQuarter: Quarter
}

const W = 420
const H = 150
const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const CROWD_BOX = { width: W, height: 78, left: 44, right: 6, top: 8, bottom: 4 }
const SMOKE_BOX = { width: W, height: 46, left: 44, right: 6, top: 6, bottom: 4 }

export function MonthCrowdSmoke({ hikeName, months, selectedQuarter }: Props) {
  const series = monthSeries(months)
  const crowd = barLayout(series.map((s) => s.crowd), CROWD_BOX, 1)
  const smokeMax = Math.max(2, ...series.map((s) => s.smoky ?? 0))
  const smoke = barLayout(series.map((s) => s.smoky), SMOKE_BOX, smokeMax)
  const first = (selectedQuarter - 1) * 3
  const frameX = crowd[first].x - 3
  const frameW = crowd[first + 2].x + crowd[first + 2].w + 3 - frameX
  const summary = series.map((s) => `${NAMES[s.month - 1]} crowd ${s.crowd === null ? 'no data' : `${Math.round(s.crowd * 100)} percent of busiest month`}, ${s.smoky === null ? 'no smoke data' : `${s.smoky.toFixed(1)} smoky days`}`).join('; ')
  return (
    <figure className="dash-card wide">
      <figcaption>Crowds and smoky days by month <span>(typical, past years; park-level crowds)</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${hikeName}: crowd level and smoky days for each month. ${summary}.`}>
        <rect x={frameX} y={2} width={frameW} height={H - 18} className="dash-frame" />
        <text x={CROWD_BOX.left - 5} y={CROWD_BOX.top + 6} textAnchor="end" className="dash-axis">Crowds</text>
        <text x={SMOKE_BOX.left - 5} y={CROWD_BOX.height + 12} textAnchor="end" className="dash-axis">Smoky</text>
        {crowd.map((b, i) => (
          <rect key={`c${i}`} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, series[i].crowd === null ? 0 : 1)} className="dash-bar" />
        ))}
        <g transform={`translate(0 ${CROWD_BOX.height})`}>
          {smoke.map((b, i) => (
            <g key={`s${i}`}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} className="dash-bar smoke" />
              {series[i].smoky !== null && series[i].smoky! >= 0.5 && <text x={b.x + b.w / 2} y={b.y - 2} textAnchor="middle" className="dash-val small">{Math.round(series[i].smoky!)}</text>}
            </g>
          ))}
        </g>
        {crowd.map((b, i) => (
          <text key={`m${i}`} x={b.x + b.w / 2} y={H - 4} textAnchor="middle" className={Math.floor(i / 3) + 1 === selectedQuarter ? 'dash-axis sel' : 'dash-axis'}>{LETTERS[i]}</text>
        ))}
      </svg>
    </figure>
  )
}
