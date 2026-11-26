// Elevation profile with time (CLAUDE.md "On the trail", v2 design). X = distance walked, Y = elevation, drawn to scale from the
// smoothed profile. An out-and-back hike is the climb and then the return. Checkpoints C0..Cn are labelled on the curve, and their
// clock times (up and back) sit in a "Clock" row under the distance axis. The hiker marker shows where you are at the scrubbed time;
// drag or click the chart to move it, hover for a ghost marker with its clock time. D3 scales and shapes, React SVG.
import { area, line, scaleLinear, ticks } from 'd3'
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { checkpointLabel, type TrailPoint } from '../../lib/trail'
import { distFromM, distUnit, elevFromM, elevUnit, type Units } from '../../lib/units'
import { formatClock, type Position, type TimelineEvent } from '../../models/checkpoints'

interface Props {
  curve: TrailPoint[]
  events: TimelineEvent[]
  pos: Position
  /** Clock minutes at the hiker marker (for its "You, 9:44 am" tag). */
  nowMin: number
  units: Units
  /** Drag or click: the distance walked (NPS-scaled metres) under the pointer. */
  onScrub: (walkedM: number) => void
  /** Clock minutes when the hiker has walked `walkedM`, for the hover ghost. */
  timeAt: (walkedM: number) => number
  /** Index into `events` of the stop in focus, drawn filled. */
  currentEvent: number
  hikeName: string
}

// Drawn at the width it is shown at (1 SVG unit = 1 CSS pixel) so text keeps its real size on a phone.
// Narrow (a phone): no clock row and fewer ticks; the checkpoint table has every time.
const NARROW_BELOW = 560
const DEFAULT_W = 760
const LABEL_GAP = 22 // px: closer checkpoint labels are skipped (the table has them)
const CLOCK_GAP = 34
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const short = (min: number) => formatClock(min).replace(/ (am|pm)$/, '')

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

export function ElevationProfile({ curve, events, pos, nowMin, units, onScrub, timeAt, currentEvent, hikeName }: Props) {
  const [wrap, W] = useWidth()
  const [ghost, setGhost] = useState<number | null>(null)
  const narrow = W < NARROW_BELOW
  const M = narrow ? { top: 28, right: 12, bottom: 46, left: 52 } : { top: 34, right: 16, bottom: 76, left: 64 }
  const H = narrow ? 230 : 290
  const base = H - M.bottom
  const totalM = curve[curve.length - 1].walkedM
  const hasReturn = curve.some((p) => p.dir === 'down')
  const turn = events.reduce((b, e) => (e.dir === 'up' && e.walkedM >= b.walkedM ? e : b), events[0]) // the farthest point going up

  const { x, y, xTicks, yTicks, path, fill } = useMemo(() => {
    const elevs = curve.map((p) => elevFromM(p.elevM, units))
    const yScale = scaleLinear().domain([Math.min(...elevs), Math.max(...elevs)]).nice(4).range([base, M.top + 8])
    const xScale = scaleLinear().domain([0, totalM]).range([M.left, W - M.right])
    const dispMax = distFromM(totalM, units)
    const special = [0, totalM, ...(hasReturn ? [turn.walkedM] : [])].map((m) => xScale(m))
    const xt = ticks(0, dispMax, narrow ? 4 : 7)
      .map((d) => ({ d, m: (d / dispMax) * totalM }))
      .filter((t) => special.every((sx) => Math.abs(xScale(t.m) - sx) > 28))
    const px = (p: TrailPoint): [number, number] => [xScale(p.walkedM), yScale(elevFromM(p.elevM, units))]
    return {
      x: xScale, y: yScale, xTicks: xt, yTicks: yScale.ticks(4),
      path: line<TrailPoint>().x((p) => px(p)[0]).y((p) => px(p)[1])(curve) ?? '',
      fill: area<TrailPoint>().x((p) => px(p)[0]).y0(base).y1((p) => px(p)[1])(curve) ?? '',
    }
  }, [curve, totalM, units, W, base, narrow, hasReturn, turn.walkedM]) // eslint-disable-line react-hooks/exhaustive-deps -- M follows narrow

  const walkedAt = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * W
    return clamp(x.invert(clamp(vx, M.left, W - M.right)), 0, totalM)
  }
  const hx = x(pos.walkedM)
  const hy = y(elevFromM(pos.elev, units))
  const dist = (m: number) => distFromM(m, units)
  const fmtD = (m: number) => (dist(m) >= 10 ? dist(m).toFixed(0) : dist(m).toFixed(1).replace(/\.0$/, ''))

  // checkpoint labels above the curve, skipping any that would collide (the turnaround always wins); then the clock row:
  // two staggered lines, a time too close to the one before it on the same line is left to the table
  const labelled: boolean[] = []
  const clock: number[] = []
  let lastX = -Infinity
  const lastOnRow = [-Infinity, -Infinity]
  events.forEach((e, i) => {
    const cx = x(e.walkedM)
    labelled.push(e === turn || cx - lastX >= LABEL_GAP)
    if (labelled[i]) lastX = cx
    const row = i % 2
    const ok = !narrow && (cx - lastOnRow[row] >= CLOCK_GAP || i === events.length - 1)
    if (ok) lastOnRow[row] = cx
    clock.push(ok ? row : -1)
  })

  const youTag = `You, ${formatClock(nowMin)}`
  const tagW = youTag.length * 6.6 + 16
  const tagLeft = hx - tagW - 12 >= M.left ? hx - tagW - 12 : hx + 12
  const ghostX = ghost === null ? null : x(ghost)
  const label = `Elevation profile of ${hikeName}: Distance walked (${distUnit(units)}) against Elevation (${elevUnit(units)})${hasReturn ? ', the climb and then the return on the same trail' : ''}. You are ${fmtD(pos.walkedM)} ${distUnit(units)} along at ${formatClock(nowMin)}. Checkpoint times are in the table below.`

  return (
    <div ref={wrap} className="elevwrap">
      <svg
        className="elevchart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onScrub(walkedAt(e)) }}
        onPointerMove={(e) => { if (e.buttons === 1) { onScrub(walkedAt(e)); setGhost(null) } else if (e.pointerType === 'mouse') setGhost(walkedAt(e)) }}
        onPointerLeave={() => setGhost(null)}
      >
        <title>{label}</title>

        {/* grid and elevation ticks, the unit on the top one */}
        {yTicks.map((t, i) => (
          <g key={`y${t}`}>
            <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={M.left - 6} y={y(t) + 4} textAnchor="end">{t.toLocaleString('en-US')}{i === yTicks.length - 1 ? ` ${elevUnit(units)}` : ''}</text>
          </g>
        ))}

        <path d={fill} className="area" />
        <path d={path} className="line-up" fill="none" />
        <line className="axisline" x1={M.left} x2={W - M.right} y1={base} y2={base} />

        {/* distance axis: 0, the turnaround, the total, and round numbers in between */}
        <g className="axis">
          <text x={M.left} y={base + 15} textAnchor="start">0 {distUnit(units)}</text>
          {xTicks.map((t) => <text key={`x${t.d}`} x={x(t.m)} y={base + 15} textAnchor="middle">{t.d}</text>)}
          {hasReturn && <text className="turn" x={x(turn.walkedM)} y={base + 15} textAnchor="middle">{fmtD(turn.walkedM)} turn back</text>}
          <text x={W - M.right} y={base + 15} textAnchor="end">{fmtD(totalM)} {distUnit(units)}</text>
        </g>

        {/* checkpoints: hollow on the curve, the stop in focus filled; labels above */}
        {events.map((e, i) => {
          const cx = x(e.walkedM)
          const cy = y(elevFromM(e.elevM, units))
          const up = e.dir === 'up'
          const anchor = cx < M.left + 12 ? 'start' : cx > W - M.right - 12 ? 'end' : 'middle'
          return (
            <g key={`${e.checkpoint.id}-${e.dir}-${i}`} className={`cp${i === currentEvent ? ' on' : ''}`}>
              <title>{`${checkpointLabel(e.checkpoint.id)} ${e.checkpoint.name}, ${up ? 'going up' : 'coming back'}, ${formatClock(e.time)}`}</title>
              <circle cx={cx} cy={cy} r={narrow ? 3.5 : 4} className={up ? 'cp-up' : 'cp-down'} />
              {labelled[i] && <text className={`cp-label${e === turn ? ' turn' : ''}`} x={cx} y={cy - 10} textAnchor={anchor}>{checkpointLabel(e.checkpoint.id)}</text>}
            </g>
          )
        })}

        {/* clock row: the time you reach each checkpoint, going up and coming back */}
        {!narrow && (
          <g>
            <text className="axis" x={M.left - 6} y={base + 50} textAnchor="end">Clock</text>
            {events.map((e, i) => {
              if (clock[i] < 0) return null
              const cx = x(e.walkedM)
              const ty = base + 42 + clock[i] * 16
              const anchor = i === 0 ? 'start' : i === events.length - 1 ? 'end' : 'middle'
              return (
                <g key={`t${i}`}>
                  <line className="tick" x1={cx} x2={cx} y1={base + 22} y2={ty - 11} />
                  <text className={`cp-time${e === turn ? ' turn' : ''}`} x={cx} y={ty} textAnchor={anchor}>{short(e.time)}</text>
                </g>
              )
            })}
          </g>
        )}

        {/* hover ghost */}
        {ghostX !== null && ghost !== null && (
          <g className="ghost" aria-hidden="true">
            <line x1={ghostX} x2={ghostX} y1={M.top} y2={base} />
            <text x={clamp(ghostX, M.left + 30, W - M.right - 30)} y={M.top - 4} textAnchor="middle">{formatClock(timeAt(ghost))}</text>
          </g>
        )}

        {/* the hiker */}
        <line className="hiker-line" x1={hx} x2={hx} y1={M.top} y2={base} />
        <circle className="hiker" cx={hx} cy={hy} r={narrow ? 7 : 8} />
        {narrow
          ? <text className="you" x={clamp(hx, M.left + 40, W - M.right - 40)} y={H - 6} textAnchor="middle">{youTag}</text>
          : (
            <g className="you-tag">
              <rect x={tagLeft} y={clamp(hy - 32, M.top, base - 24)} width={tagW} height={24} rx={6} />
              <text x={tagLeft + tagW / 2} y={clamp(hy - 32, M.top, base - 24) + 16} textAnchor="middle">{youTag}</text>
            </g>
          )}
      </svg>
    </div>
  )
}
