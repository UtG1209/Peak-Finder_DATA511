// The v2 "When" month chart: ONE chart for the 12 months, drawn to scale with D3 scales as React SVG.
// Rows: typical high (median line, middle half of past years shaded) against the user's limit band, crowd bars, smoky / wet / daylight numbers.
// Direct labels, no legend. The chosen quarter's three months are framed; the picked month (linked selection) is highlighted in every row.
// Real buttons sit over the 12 columns (click, Enter/Space; Left/Right step, Home/End jump, Esc clears), each with the month's values in words.
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { line, scaleBand, scaleLinear, area, max, min } from 'd3'
import type { HikeMonth, Quarter } from '../../data/schema'
import { monthWords } from '../../lib/when'
import { MONTH_NAMES, QUARTERS } from '../../lib/quarters'
import { fmtTemp, fmtTempRange, fToC, type Units } from '../../lib/units'

const W = 760
const X0 = 72
const X1 = 752
const H = 404
const T_TOP = 14
const T_BOT = 170
const C_BASE = 260
const C_H = 56 // crowd ratio 1.0 = 56 units tall
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const n1 = (n: number) => String(Number(n.toFixed(1)))

interface Props {
  /** The 12 typical months of the hike. */
  year: HikeMonth[]
  q: Quarter
  /** The user's temperature band in °F, or null (Any). */
  limit: [number, number] | null
  units: Units
  /** Months with a heat hazard: hatched in the temperature panel. */
  heatMonths: number[]
  month: number | null
  onMonth: (m: number | null) => void
  hikeName: string
}

export function MonthChart({ year, q, limit, units, heatMonths, month, onMonth, hikeName }: Props) {
  const ys = [...year].sort((a, b) => a.month - b.month)
  const [hover, setHover] = useState<number | null>(null)
  const btns = useRef<(HTMLButtonElement | null)[]>([])
  const hatch = `hz-${useId().replace(/:/g, '')}`
  const T = (f: number) => (units === 'metric' ? fToC(f) : f)

  const x = scaleBand<number>().domain(ys.map((m) => m.month)).range([X0, X1])
  const bw = x.bandwidth()
  const cx = (m: number) => (x(m) ?? X0) + bw / 2

  const temps = ys.flatMap((m) => [m.tmax_p25, m.tmax_p50, m.tmax_p75]).filter((v): v is number => v !== null)
  const hasTemp = temps.length > 0
  const lo = (min(temps) ?? 40) - 5
  const hi = (max(temps) ?? 90) + 5
  // the limit band widens the axis a little, never so much that the data gets flat
  const dom: [number, number] = [T(Math.min(lo, limit ? Math.max(limit[0], lo - 15) : lo)), T(Math.max(hi, limit ? Math.min(limit[1], hi + 15) : hi))]
  const y = scaleLinear().domain(dom).nice().range([T_BOT, T_TOP])
  const yc = (f: number) => y(T(f))
  const median = line<HikeMonth>().defined((m) => m.tmax_p50 !== null).x((m) => cx(m.month)).y((m) => yc(m.tmax_p50!))
  const band = area<HikeMonth>().defined((m) => m.tmax_p25 !== null && m.tmax_p75 !== null).x((m) => cx(m.month)).y0((m) => yc(m.tmax_p25!)).y1((m) => yc(m.tmax_p75!))
  const crowdY = scaleLinear().domain([0, 1]).range([C_BASE, C_BASE - C_H])

  const qm = QUARTERS[q - 1].monthNumbers
  const focus = hover ?? month
  const hottest = hasTemp ? ys.reduce((a, b) => ((b.tmax_p50 ?? -Infinity) > (a.tmax_p50 ?? -Infinity) ? b : a)) : null
  const busiest = ys.reduce((a, b) => (b.crowd_level > a.crowd_level ? b : a))
  const heatRun = heatMonths.length ? [Math.min(...heatMonths), Math.max(...heatMonths)] : null
  const limitTop = limit ? Math.max(T_TOP, yc(limit[1])) : 0
  const limitBot = limit ? Math.min(T_BOT, yc(limit[0])) : 0
  const tipM = focus ? ys.find((m) => m.month === focus) : undefined

  const pick = (m: number) => { onMonth(m); btns.current[m - 1]?.focus() }
  const onKey = (e: KeyboardEvent, m: number) => {
    const to = e.key === 'ArrowRight' ? Math.min(12, m + 1) : e.key === 'ArrowLeft' ? Math.max(1, m - 1) : e.key === 'Home' ? 1 : e.key === 'End' ? 12 : null
    if (to !== null) { e.preventDefault(); pick(to) }
    if (e.key === 'Escape') { setHover(null); onMonth(null) }
  }
  const tabMonth = month ?? qm[0]

  const summary = hasTemp && hottest
    ? `Typical month by month at ${hikeName}. Daytime high peaks at ${fmtTemp(hottest.tmax_p50!, units)} in ${FULL[hottest.month - 1]}${limit ? `; your ${fmtTempRange(limit[0], limit[1], units)} band is shaded` : ''}. Crowds peak in ${FULL[busiest.month - 1]}. Use the month buttons for each month's values, or Show as table.`
    : `Typical month by month at ${hikeName}. No weather station within 50 km, so there is no temperature row. Crowds peak in ${FULL[busiest.month - 1]}.`

  return (
    <div className="wc-scroll">
      <div className="wc-plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} className="wc-svg">
          <defs>
            <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="wc-hatch" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            {hover !== null && <rect x={x(hover)} y={0} width={bw} height={H - 16} className="wc-hover" />}
            {month !== null && <rect x={x(month)} y={0} width={bw} height={H - 16} className="wc-picked" />}
            <rect x={x(qm[0])} y={0} width={bw * 3} height={H - 16} rx={8} className="wc-frame" />

            {/* typical high */}
            {hasTemp ? (
              <>
                {limit && limitBot > limitTop && (
                  <>
                    <rect x={X0} y={limitTop} width={X1 - X0} height={limitBot - limitTop} className="wc-limit" />
                    <text x={X0 + 6} y={limitTop + 14} className="wc-t wc-ta wc-b wc-halo">Your limit, {fmtTempRange(limit[0], limit[1], units)}</text>
                  </>
                )}
                {heatRun && <rect x={x(heatRun[0])} y={T_TOP} width={(x(heatRun[1]) ?? 0) + bw - (x(heatRun[0]) ?? 0)} height={T_BOT - T_TOP} fill={`url(#${hatch})`} />}
                {y.ticks(4).map((t) => (
                  <g key={t}>
                    <line x1={X0} x2={X1} y1={y(t)} y2={y(t)} className="wc-grid" />
                    <text x={X0 - 8} y={y(t) + 4} textAnchor="end" className="wc-t wc-tm">{t}{units === 'metric' ? '°C' : '°F'}</text>
                  </g>
                ))}
                <path d={band(ys) ?? ''} className="wc-band" />
                <path d={median(ys) ?? ''} className="wc-line" />
                {ys.filter((m) => m.tmax_p50 !== null).map((m) => (
                  <circle key={m.month} cx={cx(m.month)} cy={yc(m.tmax_p50!)} r={m.month === focus ? 5 : 3} className={m.month === focus ? 'wc-dot on' : 'wc-dot'} />
                ))}
                {hottest && hottest.month !== focus && <text x={cx(hottest.month)} y={yc(hottest.tmax_p50!) - 10} textAnchor="middle" className="wc-n wc-tx">{fmtTemp(hottest.tmax_p50!, units)}</text>}
                {tipM?.tmax_p50 != null && <text x={cx(tipM.month)} y={yc(tipM.tmax_p50) - 10} textAnchor="middle" className="wc-n wc-ta">{fmtTemp(tipM.tmax_p50, units)}</text>}
                <text x={X0} y={T_BOT + 16} className="wc-t wc-tm">Typical high, middle half of past years shaded</text>
              </>
            ) : (
              <>
                <rect x={X0} y={T_TOP} width={X1 - X0} height={T_BOT - T_TOP} rx={8} className="wc-missing" />
                <text x={(X0 + X1) / 2} y={(T_TOP + T_BOT) / 2} textAnchor="middle" className="wc-t wc-tb">No station within 50 km: temperature is left out of the match</text>
              </>
            )}

            {/* crowds, park level */}
            {[0.4, 0.7].map((v) => <line key={v} x1={X0} x2={X1} y1={crowdY(v)} y2={crowdY(v)} className="wc-grid dash" />)}
            <line x1={X0} x2={X1} y1={C_BASE} y2={C_BASE} className="wc-base" />
            <text x={X0 - 8} y={crowdY(0.85) + 4} textAnchor="end" className="wc-t wc-tm">Busy</text>
            <text x={X0 - 8} y={crowdY(0.55) + 4} textAnchor="end" className="wc-t wc-tm">Moderate</text>
            <text x={X0 - 8} y={crowdY(0.2) + 4} textAnchor="end" className="wc-t wc-tm">Quiet</text>
            {ys.map((m) => (
              <rect key={m.month} x={cx(m.month) - 12} y={crowdY(m.crowd_level)} width={24} height={C_BASE - crowdY(m.crowd_level)} className={qm.includes(m.month) ? 'wc-bar inq' : 'wc-bar'} />
            ))}
            <text x={cx(busiest.month)} y={crowdY(busiest.crowd_level) - 6} textAnchor="middle" className="wc-t wc-tb">Peak</text>

            {/* day counts and daylight */}
            <text x={X0 - 8} y={294} textAnchor="end" className="wc-t wc-tm">Smoky days</text>
            <text x={X0 - 8} y={318} textAnchor="end" className="wc-t wc-tm">Wet days</text>
            <text x={X0 - 8} y={342} textAnchor="end" className="wc-t wc-tm">Daylight h</text>
            {ys.map((m) => {
              const on = m.month === focus ? ' wc-tx' : ''
              return (
                <g key={m.month} textAnchor="middle" className="wc-n">
                  <text x={cx(m.month)} y={294} className={m.smoky_days >= 1 ? 'wc-th' : on || 'wc-tm'}>{n1(m.smoky_days)}</text>
                  <text x={cx(m.month)} y={318} className={m.wet_days === null ? 'wc-off' : on || 'wc-tm'}>{m.wet_days === null ? 'n/a' : n1(m.wet_days)}</text>
                  <text x={cx(m.month)} y={342} className={on || 'wc-tm'}>{m.daylight_hr.toFixed(1)}</text>
                  <text x={cx(m.month)} y={368} className={`wc-mname ${m.month === focus ? 'wc-ta' : qm.includes(m.month) ? 'wc-tx' : 'wc-tb'}`}>{MONTH_NAMES[m.month - 1]}</text>
                </g>
              )
            })}
            {QUARTERS.map((qq) => (
              <text key={qq.q} x={cx(qq.monthNumbers[1])} y={392} textAnchor="middle" className={`wc-t ${qq.q === q ? 'wc-ta wc-b' : 'wc-tm'}`}>
                {qq.label} · {qq.season[0].toUpperCase() + qq.season.slice(1)}
              </text>
            ))}
          </g>
        </svg>

        <div className="wc-cols" role="group" aria-label="Pick a month">
          {ys.map((m) => {
            const w = monthWords(m, units)
            return (
              <button
                key={m.month}
                ref={(el) => { btns.current[m.month - 1] = el }}
                type="button"
                className="wc-col"
                tabIndex={m.month === tabMonth ? 0 : -1}
                aria-pressed={month === m.month}
                aria-label={`${FULL[m.month - 1]}, typical: ${w.high}. ${w.crowd}. ${w.days}. ${w.light}.`}
                onClick={() => onMonth(month === m.month ? null : m.month)}
                onKeyDown={(e) => onKey(e, m.month)}
                onMouseEnter={() => setHover(m.month)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </div>

        {tipM && (
          <div className={`wc-tip${tipM.month > 6 ? ' left' : ''}`} style={{ left: `${(cx(tipM.month) / W) * 100}%` }} aria-hidden="true">
            <b>{FULL[tipM.month - 1]}, typical</b>
            {Object.values(monthWords(tipM, units)).map((s) => <span key={s}>{s}</span>)}
            <small>Past years. NOAA, NPS, EPA</small>
          </div>
        )}
      </div>
    </div>
  )
}
