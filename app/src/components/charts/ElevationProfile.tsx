// Elevation profile with time (CLAUDE.md "On the trail"). X = distance walked, Y = elevation, with axes and units.
// An out-and-back hike is two humps: the climb (solid line, filled markers) and the return (dashed line, hollow markers).
// Checkpoints C0..Cn carry the clock time you reach them. A hiker marker shows where you are at the scrubbed time;
// drag anywhere on the chart to move it. D3 scales and shapes, React SVG.
import { area, line, scaleLinear, ticks } from 'd3'
import { useId, useMemo, type PointerEvent } from 'react'
import { checkpointLabel, type TrailPoint } from '../../lib/trail'
import { distFromM, distUnit, elevFromM, elevUnit, type Units } from '../../lib/units'
import { formatClock, type Position, type TimelineEvent } from '../../models/checkpoints'

interface Props {
  curve: TrailPoint[]
  events: TimelineEvent[]
  pos: Position
  units: Units
  /** Drag: the distance walked (NPS-scaled metres) under the pointer. */
  onScrub: (walkedM: number) => void
  hikeName: string
}

const W = 780
const H = 350
const M = { top: 78, right: 18, bottom: 46, left: 64 }
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function ElevationProfile({ curve, events, pos, units, onScrub, hikeName }: Props) {
  const uid = useId()
  const totalM = curve[curve.length - 1].walkedM
  const { x, y, xTicks, yTicks, up, down, fill } = useMemo(() => {
    const elevs = curve.map((p) => elevFromM(p.elevM, units))
    const yScale = scaleLinear().domain([Math.min(...elevs), Math.max(...elevs)]).nice().range([H - M.bottom, M.top])
    const xScale = scaleLinear().domain([0, totalM]).range([M.left, W - M.right])
    const dispMax = distFromM(totalM, units)
    const xt = ticks(0, dispMax, 7).map((d) => ({ d, m: (d / dispMax) * totalM }))
    const px = (p: TrailPoint): [number, number] => [xScale(p.walkedM), yScale(elevFromM(p.elevM, units))]
    const ln = line<TrailPoint>().x((p) => px(p)[0]).y((p) => px(p)[1])
    const ar = area<TrailPoint>().x((p) => px(p)[0]).y0(H - M.bottom).y1((p) => px(p)[1])
    const upPts = curve.filter((p) => p.dir === 'up')
    const downPts = curve.filter((p) => p.dir === 'down')
    return {
      x: xScale, y: yScale, xTicks: xt, yTicks: yScale.ticks(5),
      up: ln(upPts) ?? '', down: downPts.length ? ln([upPts[upPts.length - 1], ...downPts]) ?? '' : '',
      fill: ar(curve) ?? '',
    }
  }, [curve, totalM, units])

  const scrubFrom = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * W
    onScrub(clamp(x.invert(clamp(vx, M.left, W - M.right)), 0, totalM))
  }
  const hasReturn = curve.some((p) => p.dir === 'down')
  const hx = x(pos.walkedM)
  const hy = y(elevFromM(pos.elev, units))

  return (
    <svg
      className="elevchart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Elevation profile of ${hikeName}: distance walked in ${distUnit(units)} against elevation in ${elevUnit(units)}${hasReturn ? ', the climb and then the return' : ''}. Checkpoint times are listed in the table below.`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubFrom(e) }}
      onPointerMove={(e) => { if (e.buttons === 1) scrubFrom(e) }}
    >
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* grid and axes */}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
          <text className="axis" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{t.toLocaleString('en-US')}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t.d}`}>
          <line className="tick" x1={x(t.m)} x2={x(t.m)} y1={H - M.bottom} y2={H - M.bottom + 5} />
          <text className="axis" x={x(t.m)} y={H - M.bottom + 18} textAnchor="middle">{t.d}</text>
        </g>
      ))}
      <line className="axisline" x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} />
      <line className="axisline" x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} />
      <text className="axis title" x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle">Distance walked ({distUnit(units)})</text>
      <text className="axis title" transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">Elevation ({elevUnit(units)})</text>

      {/* the trail */}
      <path d={fill} fill={`url(#${uid}-fill)`} />
      <path d={up} className="line-up" fill="none" />
      {hasReturn && <path d={down} className="line-down" fill="none" />}

      {/* checkpoints: filled = going up, hollow = coming back; each with its clock time */}
      {events.map((e, i) => {
        const cx = x(e.walkedM)
        const cy = y(elevFromM(e.elevM, units))
        const up = e.dir === 'up'
        // neighbouring checkpoints can be a few pixels apart near the summit: alternate two label rows so they never overlap
        const timeY = M.top - 14 - (i % 2) * 26
        return (
          <g key={`${e.checkpoint.id}-${e.dir}-${i}`} className="cp">
            <title>{`${checkpointLabel(e.checkpoint.id)} ${e.checkpoint.name}, ${up ? 'going up' : 'coming back'}, ${formatClock(e.time)}`}</title>
            <line className="cp-stem" x1={cx} x2={cx} y1={cy - 6} y2={timeY + 3} />
            <circle cx={cx} cy={cy} r={5} className={up ? 'cp-up' : 'cp-down'} />
            <text className="cp-label" x={cx} y={timeY - 11} textAnchor="middle">{checkpointLabel(e.checkpoint.id)}</text>
            <text className="cp-time" x={cx} y={timeY} textAnchor="middle">{formatClock(e.time).replace(' ', '')}</text>
          </g>
        )
      })}

      {/* the hiker */}
      <line className="hiker-line" x1={hx} x2={hx} y1={M.top} y2={H - M.bottom} />
      <circle className="hiker" cx={hx} cy={hy} r={9} />
      <circle className="hiker-dot" cx={hx} cy={hy} r={3} />

    </svg>
  )
}
