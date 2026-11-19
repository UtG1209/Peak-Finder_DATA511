import { useId } from 'react'

/** Tiny histogram of how many hikes sit at each value, drawn above a slider so people see what a move will cut. */
export function Histogram({ values, min, max, lo, hi, bins = 14 }: { values: number[]; min: number; max: number; lo: number; hi: number; bins?: number }) {
  const counts = new Array(bins).fill(0)
  for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / (max - min)) * bins)))]++
  const peak = Math.max(1, ...counts)
  return (
    <div className="hist" aria-hidden="true">
      {counts.map((c, i) => {
        const centre = min + ((i + 0.5) / bins) * (max - min)
        return <i key={i} className={centre >= lo && centre <= hi ? 'in' : ''} style={{ height: `${Math.max(8, (c / peak) * 100)}%` }} />
      })}
    </div>
  )
}

interface Props {
  label: string
  /** Text shown top right, e.g. "50–85°F" or "Any". */
  valueText: string
  anyActive?: boolean
  min: number
  max: number
  step?: number
  /** One value = a single "up to" slider; two = a range. */
  value: number | [number, number]
  onChange: (v: number | [number, number]) => void
  /** Spoken value for screen readers, e.g. (v) => `up to ${v} smoky days`. */
  spoken?: (v: number) => string
  histogram?: number[]
  disabled?: boolean
  note?: string
  unitLabel: string
}

/** Native range inputs (keyboard and spoken values for free) with the prototype's look. */
export function RangeSlider({ label, valueText, anyActive, min, max, step = 1, value, onChange, spoken, histogram, disabled, note, unitLabel }: Props) {
  const id = useId()
  const range = Array.isArray(value)
  const lo = range ? value[0] : min
  const hi = range ? value[1] : value
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const describe = (v: number) => (spoken ? spoken(v) : `${v} ${unitLabel}`)
  return (
    <div className={`ctl${disabled ? ' disabled' : ''}`}>
      <div className="ctl-h">
        <span id={`${id}-l`}>{label}</span>
        <span className={`val${anyActive ? ' off' : ''}`}>{valueText}</span>
      </div>
      {histogram && <Histogram values={histogram} min={min} max={max} lo={lo} hi={hi} />}
      <div className="rng">
        <div className="track" />
        <div className="fill" style={{ left: `${range ? pct(lo) : 0}%`, width: `${pct(hi) - (range ? pct(lo) : 0)}%` }} />
        {range && (
          <input
            className="r" type="range" min={min} max={max} step={step} value={lo} disabled={disabled}
            aria-label={`${label}, lowest`} aria-valuetext={describe(lo)}
            onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          />
        )}
        <input
          className="r" type="range" min={min} max={max} step={step} value={hi} disabled={disabled}
          aria-label={range ? `${label}, highest` : label} aria-valuetext={describe(hi)}
          onChange={(e) => onChange(range ? [lo, Math.max(Number(e.target.value), lo)] : Number(e.target.value))}
        />
      </div>
      {note && <div className="note">{note}</div>}
    </div>
  )
}
