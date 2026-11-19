// The "what to do next" guide. Until the user presses "Show hikes" the map stays blurred and this
// card says exactly one thing to do next. After that it becomes a short tip bar.
export interface NavStep {
  id: string
  label: string
  done: boolean
}

interface Props {
  steps: NavStep[]
  started: boolean
  onStart: () => void
}

/** Overlay on the blurred map: the steps, a one-line next action, and the Show hikes button. */
export function GuideOverlay({ steps, started, onStart }: Props) {
  if (started) return null
  const next = steps.find((s) => !s.done)
  return (
    <div className="guide" role="region" aria-label="How to use Peak Finder">
      <h2>Find a hike that fits your trip</h2>
      <p className="lede">Answer three quick things on the left. The map unblurs when you press <b>Show hikes</b>.</p>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.id} className={s.done ? 'done' : s === next ? 'now' : ''}>
            <span className="n" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
            <span>{s.label}</span>
            <span className="sr-only">{s.done ? ' (done)' : s === next ? ' (next)' : ''}</span>
          </li>
        ))}
      </ol>
      <p className="next" aria-live="polite">{next ? <>Next: <b>{next.label}</b></> : <>All set. Press <b>Show hikes</b>.</>}</p>
      <button type="button" className="go" onClick={onStart}>Show hikes <span aria-hidden="true">→</span></button>
      <p className="fine">You can skip any step. Every limit starts wide open, so nothing is hidden by accident.</p>
    </div>
  )
}

/** After the map is shown: the next useful thing to try. */
export function NextTip({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="tip" role="note">
      <b>What next?</b> Hover a bubble to preview a hike. Click one to see which quarter suits you and what the trip costs.
    </div>
  )
}
