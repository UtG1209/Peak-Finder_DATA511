import type { Hike } from '../data/schema'
import type { ReasonRow } from '../lib/reasons'
import { DIFFICULTY_COLORS, DIFFICULTY_LABEL } from '../lib/difficulty'

const Check = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="var(--accent)" /><path d="M5.5 10.5l3 3 6-6.5" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Warn = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l9 16H1z" fill="var(--hazard)" /><path d="M10 7.5v5M10 14.2v.6" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" /></svg>
)
const Dash = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="none" stroke="var(--off-line)" strokeWidth="1.5" /><path d="M6 10h8" stroke="var(--off-line)" strokeWidth="1.5" strokeLinecap="round" /></svg>
)

interface Props {
  hike: Hike
  quarterLabel: string
  match: number
  fits: boolean
  rows: ReasonRow[]
  /** e.g. "About $2,077 for 2 people, 3 nights". null when no home city is chosen. */
  costLine: string | null
  onOpen: () => void
}

/** The hover card: photo, name, park, three-plus reasons in words, typical cost, one button. */
export function HikeCard({ hike, quarterLabel, match, fits, rows, costLine, onOpen }: Props) {
  return (
    <aside id="detail" aria-live="polite" aria-label={`${hike.name} summary`}>
      <div className="ph">
        <img src={`${import.meta.env.BASE_URL}${hike.photo.file}`} alt={`${hike.name} (placeholder image)`} loading="lazy" />
      </div>
      <div className="in">
        <div>
          <div className={`eyebrow${fits ? '' : ' out'}`}>
            {fits ? `Fits ${quarterLabel}` : `Past a limit in ${quarterLabel}`} · {Math.round(match)}% match{hike.featured ? ' · 3D walk ready' : ''}
          </div>
          <div className="diff-tag"><i style={{ background: DIFFICULTY_COLORS[hike.difficulty] }} /> {DIFFICULTY_LABEL[hike.difficulty]} · {hike.length_mi} mi {hike.length_type}</div>
          <h3>{hike.name}</h3>
          <div className="sub">{hike.park_name}</div>
        </div>
        <div className="rows">
          {rows.map((r) => (
            <div key={r.key} className={`row${r.warn ? ' warn' : ''}`}>
              {r.warn ? <Warn /> : r.missing || r.note === 'No limit' ? <Dash /> : <Check />}
              <span className="l">{r.label}</span>
              <span className="v">{r.value}</span>
              <span className="n">{r.note}</span>
            </div>
          ))}
        </div>
        {rows.some((r) => r.missing) && <div className="cost">Left out of the match: {rows.filter((r) => r.missing).map((r) => r.label.toLowerCase()).join(', ')} (no data for this hike).</div>}
        <div className="cost">{costLine ?? 'Pick a home city to see a typical cost.'}</div>
        <button type="button" className="go" onClick={onOpen}>
          View hike <span aria-hidden="true">→</span>
        </button>
      </div>
    </aside>
  )
}
