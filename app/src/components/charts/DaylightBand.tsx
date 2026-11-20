// Daylight band: sunrise to sunset for the chosen quarter, with the hike's own span (start to finish) laid over it.
// A finish after sunset is hatched and labelled in words; the verdict sentence next to it never relies on colour alone.
import { scaleLinear } from 'd3'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { DaylightVerdict } from '../../lib/trail'
import { formatClock } from '../../models/checkpoints'

interface Props {
  verdict: DaylightVerdict
  /** Where the scrubber is, in clock minutes. */
  nowMin: number
}

// Drawn at the width it is shown at (1 unit = 1 CSS pixel) so labels keep their real size on a phone. Row titles sit above their bars.
const DEFAULT_W = 780
const NARROW_BELOW = 560
const M = { left: 12, right: 12 }

export function DaylightBand({ verdict, nowMin }: Props) {
  const uid = useId()
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
  const H = narrow ? 134 : 116
  const lo = Math.floor((Math.min(verdict.sunriseMin, verdict.startMin) - 45) / 60) * 60
  const hi = Math.ceil((Math.max(verdict.sunsetMin, verdict.finishMin) + 45) / 60) * 60
  const x = scaleLinear().domain([lo, hi]).range([M.left, W - M.right])
  const dark = Math.max(verdict.sunsetMin, verdict.startMin) // the part of the hike after sunset starts here
  const walkEndDay = Math.min(verdict.finishMin, verdict.sunsetMin)
  const hasDarkPart = verdict.finishMin > verdict.sunsetMin
  const startsDark = verdict.startMin < verdict.sunriseMin
  const tag = (min: number) => formatClock(min).replace(':00', '')

  return (
    <div ref={wrap} className="daylightwrap">
    <svg className="daylightband" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
      aria-label={`Daylight: sunrise ${formatClock(verdict.sunriseMin)}, sunset ${formatClock(verdict.sunsetMin)}. Your hike runs from ${formatClock(verdict.startMin)} to ${formatClock(verdict.finishMin)}.`}>
      <defs>
        <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" className="hatch-a" />
          <rect width="3" height="7" className="hatch-b" />
        </pattern>
      </defs>
      <text className="axis title" x={M.left} y={14}>Daylight</text>
      <rect x={M.left} y={20} width={W - M.left - M.right} height={32} rx={4} className="night" />
      <rect x={x(verdict.sunriseMin)} y={20} width={x(verdict.sunsetMin) - x(verdict.sunriseMin)} height={32} rx={4} className="day" />
      <text className="sun-label" x={x(verdict.sunriseMin) + 6} y={40}>Sunrise {tag(verdict.sunriseMin)}</text>
      <text className="sun-label" x={x(verdict.sunsetMin) - 6} y={40} textAnchor="end">Sunset {tag(verdict.sunsetMin)}</text>

      {/* the hike */}
      <text className="axis title" x={M.left} y={72}>Your hike</text>
      <rect x={x(verdict.startMin)} y={78} width={Math.max(2, x(walkEndDay) - x(verdict.startMin))} height={16} rx={3} className="hikebar" />
      {hasDarkPart && <rect x={x(dark)} y={78} width={Math.max(2, x(verdict.finishMin) - x(dark))} height={16} rx={3} fill={`url(#${uid}-hatch)`} />}
      <text className="hike-label" x={x(verdict.startMin)} y={112} textAnchor="start">Start {tag(verdict.startMin)}</text>
      <text className="hike-label" x={x(verdict.finishMin)} y={narrow ? 128 : 112} textAnchor="end">{hasDarkPart ? 'After dark: back ' : 'Back '}{tag(verdict.finishMin)}</text>
      {startsDark && <text className="hike-label warn" x={W - M.right} y={14} textAnchor="end">Starts before sunrise</text>}

      <line className="hiker-line" x1={x(nowMin)} x2={x(nowMin)} y1={16} y2={98} />
      <circle className="hiker-dot-flat" cx={x(nowMin)} cy={86} r={5} />
    </svg>
    </div>
  )
}
