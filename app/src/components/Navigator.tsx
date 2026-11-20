// The "what to do next" guide. Until the user presses "Show hikes" the map stays blurred and this
// card says exactly one thing to do next. After that it becomes a short tip bar.
import { Icon } from './Icon'

export interface NavStep {
  id: string
  label: string
  done: boolean
}

interface Props {
  steps: NavStep[]
  started: boolean
  onStart: () => void
  /** Offer the random picker on the guide card too (optional). */
  onWheel?: () => void
  /** Phone only: the filters live in a sheet, so the guide offers a button that opens it. */
  onFilters?: () => void
}

/** Overlay on the blurred map: the three steps, a one-line next action, and the Show hikes button. */
export function GuideOverlay({ steps, started, onStart, onWheel, onFilters }: Props) {
  if (started) return null
  const next = steps.find((s) => !s.done)
  return (
    <div className="guide" role="region" aria-label="How to use Peak Finder">
      <h2>Which national-park hike fits your trip?</h2>
      <p className="lede">Say where you start, when you can go and how much heat, crowd, smoke and rain you will put up with. Peaks that fit stay bright on the map; the rest turn into small grey dots.</p>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.id} className={s.done ? 'done' : s === next ? 'now' : ''}>
            <span className="n" aria-hidden="true">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
            <span>{s.label}</span>
            <span className="sr-only">{s.done ? ' (done)' : s === next ? ' (next)' : ''}</span>
          </li>
        ))}
      </ol>
      <p className="next" aria-live="polite">{next ? <>Next: <b>{next.label}</b></> : <>All set. Press <b>Show hikes</b>.</>}</p>
      <button type="button" className="go" onClick={onStart}>Show hikes <Icon name="arrow-right" /></button>
      {onWheel && <button type="button" className="back" onClick={onWheel}><Icon name="shuffle" size={18} /> Not sure? Spin the wheel</button>}
      {onFilters && <button type="button" className="back m-only" onClick={onFilters}><Icon name="sliders" size={18} /> Set city, quarter and limits</button>}
      <p className="fine">Every step is optional. Each limit starts wide open, so no hike is hidden by accident.</p>
    </div>
  )
}

/** After the map is shown: the next useful thing to try. */
export function NextTip({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="tip" role="note">
      <b>Tip</b> Hover a peak to preview it, click to pin it. Open the hike to compare all four quarters and see the typical cost.
    </div>
  )
}
