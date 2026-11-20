// Elevation profile with time (CLAUDE.md "On the trail"). X = distance walked, Y = elevation, with axes and units.
// An out-and-back hike is two humps: the climb (solid line, filled markers) and the return (dashed line, hollow markers).
// Checkpoints C0..Cn carry the clock time you reach them. A hiker marker shows where you are at the scrubbed time;
// drag anywhere on the chart to move it. D3 scales and shapes, React SVG.
import { area, line, scaleLinear, ticks } from 'd3'
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
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

// The chart is drawn at the width it is shown at (1 SVG unit = 1 CSS pixel), so its text is the real size on a phone too.
// Narrow (a phone): fewer ticks and checkpoint labels only at the start, the turnaround and the finish; the table under the chart has every time.
const NARROW_BELOW = 560
const DEFAULT_W = 780
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(DEFAULT_W)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function ElevationProfile({ curve, events, pos, units, onScrub, hikeName }: Props) {
  const [wrap, W] = useWidth()
  const narrow = W < NARROW_BELOW
  const H = narrow ? 300 : 350
  const M = narrow ? { top: 64, right: 12, bottom: 52, left: 56 } : { top: 78, right: 18, bottom: 52, left: 64 }
  const totalM = curve[curve.length - 1].walkedM
  const { x, y, xTicks, yTicks, up, down, fill } = useMemo(() => {
    const elevs = curve.map((p) => elevFromM(p.elevM, units))
    const yScale = scaleLinear().domain([Math.min(...elevs), Math.max(...elevs)]).nice().range([H - M.bottom, M.top])
    const xScale = scaleLinear().domain([0, totalM]).range([M.left, W - M.right])
    const dispMax = distFromM(totalM, units)
    const xt = ticks(0, dispMax, narrow ? 4 : 7).map((d) => ({ d, m: (d / dispMax) * totalM }))
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
  }, [curve, totalM, units, W, H, narrow]) // eslint-disable-line react-hooks/exhaustive-deps -- M follows narrow

  const scrubFrom = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * W
    onScrub(clamp(x.invert(clamp(vx, M.left, W - M.right)), 0, totalM))
  }
  const turn = events.reduce((b, e) => (e.dir === 'up' && e.walkedM >= b.walkedM ? e : b), events[0]) // the farthest point going up
  const hasReturn = curve.some((p) => p.dir === 'down')
  const hx = x(pos.walkedM)
  const hy = y(elevFromM(pos.elev, units))

  return (
    <div ref={wrap} className="elevwrap">
    <svg
      className="elevchart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
      aria-label={`Elevation profile of ${hikeName}: distance walked in ${distUnit(units)} against elevation in ${elevUnit(units)}${hasReturn ? ', the climb and then the return' : ''}. Checkpoint times are in the table below.`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubFrom(e) }}
      onPointerMove={(e) => { if (e.buttons === 1) scrubFrom(e) }}
    >

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
      <path d={fill} className="area" />
      <path d={up} className="line-up" fill="none" />
      {hasReturn && <path d={down} className="line-down" fill="none" />}

      {/* checkpoints: filled = going up, hollow = coming back; each with its clock time */}
      {events.map((e, i) => {
        const cx = x(e.walkedM)
        const cy = y(elevFromM(e.elevM, units))
        const up = e.dir === 'up'
        // neighbouring checkpoints can be a few pixels apart near the summit: alternate two label rows so they never overlap
        const timeY = M.top - 14 - (i % 2) * 28
        const labelled = !narrow || i === 0 || i === events.length - 1 || e === turn
        const anchor = cx < M.left + 24 ? 'start' : cx > W - M.right - 40 ? 'end' : 'middle'
        const tx = anchor === 'start' ? cx - 4 : anchor === 'end' ? cx + 4 : cx
        return (
          <g key={`${e.checkpoint.id}-${e.dir}-${i}`} className="cp">
            <title>{`${checkpointLabel(e.checkpoint.id)} ${e.checkpoint.name}, ${up ? 'going up' : 'coming back'}, ${formatClock(e.time)}`}</title>
            {labelled && <line className="cp-stem" x1={cx} x2={cx} y1={cy - 6} y2={timeY + 3} />}
            <circle cx={cx} cy={cy} r={5} className={up ? 'cp-up' : 'cp-down'} />
            {labelled && <text className="cp-label" x={tx} y={timeY - 13} textAnchor={anchor}>{checkpointLabel(e.checkpoint.id)}</text>}
            {labelled && <text className="cp-time" x={tx} y={timeY} textAnchor={anchor}>{formatClock(e.time).replace(' ', '')}</text>}
          </g>
        )
      })}

      {/* the hiker */}
      <line className="hiker-line" x1={hx} x2={hx} y1={M.top} y2={H - M.bottom} />
      <circle className="hiker" cx={hx} cy={hy} r={9} />
      <circle className="hiker-dot" cx={hx} cy={hy} r={3} />

    </svg>
    </div>
  )
}
