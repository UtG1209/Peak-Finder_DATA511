// Daylight band (v2): one track of the day, the daylight span from sunrise to sunset, your hike laid over it and a tick where the
// scrubber is. The part of a hike after sunset is drawn in the hazard colour and named in words; never colour alone.
import { scaleLinear } from 'd3'
import { useLayoutEffect, useRef, useState } from 'react'
import { hourTicks, type DaylightVerdict } from '../../lib/trail'
import { formatClock } from '../../models/checkpoints'

interface Props {
  verdict: DaylightVerdict
  /** Where the scrubber is, in clock minutes. */
  nowMin: number
  /** Month name for the label, e.g. "Nov". */
  monthLabel: string
}

// Drawn at the width it is shown at (1 unit = 1 CSS pixel); the left margin matches the profile so the two line up.
const DEFAULT_W = 760
const NARROW_BELOW = 560

export function DaylightBand({ verdict, nowMin, monthLabel }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(DEFAULT_W)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const read = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const narrow = W < NARROW_BELOW
  const M = narrow ? { left: 8, right: 8 } : { left: 64, right: 16 }
  const H = narrow ? 56 : 72
  const lo = Math.floor((Math.min(verdict.sunriseMin, verdict.startMin) - 45) / 60) * 60
  const hi = Math.ceil((Math.max(verdict.sunsetMin, verdict.finishMin) + 45) / 60) * 60
  const x = scaleLinear().domain([lo, hi]).range([M.left, W - M.right])
  const dayEnd = Math.min(verdict.finishMin, verdict.sunsetMin)
  const darkFrom = Math.max(verdict.sunsetMin, verdict.startMin)
  const hasDarkPart = verdict.finishMin > verdict.sunsetMin
  const startsDark = verdict.startMin < verdict.sunriseMin
  const span = `${formatClock(verdict.startMin)} to ${formatClock(verdict.finishMin)}`
  const hikeLabel = hasDarkPart ? `After dark: your hike runs ${span}` : narrow ? 'Your hike' : `Your hike, ${span}`
  const mid = (x(verdict.startMin) + x(verdict.finishMin)) / 2
  const half = hikeLabel.length * 3.3
  const labelX = Math.min(W - M.right - half, Math.max(M.left + half, mid))
  const Y = 22 // top of the track

  return (
    <div ref={wrap} className="daylightwrap">
      <svg className="daylightband" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img">
        <title>{`Daylight in ${monthLabel}, typical for past years: sunrise ${formatClock(verdict.sunriseMin)}, sunset ${formatClock(verdict.sunsetMin)}. Your hike runs ${span}${hasDarkPart ? ', finishing after dark' : ', inside daylight'}${startsDark ? ', starting before sunrise' : ''}.`}</title>
        {!narrow && <text className="axis" x={M.left - 6} y={Y + 11} textAnchor="end">Daylight</text>}
        <rect x={M.left} y={Y} width={W - M.left - M.right} height={14} rx={2} className="night" />
        <rect x={x(verdict.sunriseMin)} y={Y} width={x(verdict.sunsetMin) - x(verdict.sunriseMin)} height={14} className="day" />
        {dayEnd > verdict.startMin && (
          <rect x={x(verdict.startMin)} y={Y} width={Math.max(2, x(dayEnd) - x(verdict.startMin))} height={14} rx={2} className="hikebar" />
        )}
        {hasDarkPart && <rect x={x(darkFrom)} y={Y} width={Math.max(3, x(verdict.finishMin) - x(darkFrom))} height={14} className="hikedark" />}
        <text className="sun-label" x={x(verdict.sunriseMin)} y={Y - 8}>{narrow ? '' : 'Sunrise '}{formatClock(verdict.sunriseMin)}</text>
        <text className="sun-label" x={x(verdict.sunsetMin)} y={Y - 8} textAnchor="end">Sunset {formatClock(verdict.sunsetMin)}</text>
        <line className="sunset-mark" x1={x(verdict.sunsetMin)} x2={x(verdict.sunsetMin)} y1={Y - 4} y2={Y + 18} />
        <text className={`hike-label${hasDarkPart ? ' warn' : ''}`} x={labelX} y={Y + 30} textAnchor="middle">{hikeLabel}</text>
        {!narrow && hourTicks(lo, hi).map((t, i, all) => (
          <text key={t.min} className="axis" x={x(t.min)} y={H - 2} textAnchor={i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle'}>{t.label}</text>
        ))}
        <line className="now" x1={x(nowMin)} x2={x(nowMin)} y1={Y - 4} y2={Y + 18} />
      </svg>
    </div>
  )
}
