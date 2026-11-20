// "Which quarter fits you?": Q1 to Q4 chips with match %, the best quarter marked, and under them one bar per factor
// for the chosen quarter: the hike's typical value against the user's limit, in words.
import type { HikeMonth, Quarter } from '../../data/schema'
import { StatusIcon } from '../../components/StatusIcon'
import { fitRows, type FitRow } from '../../lib/fit'
import type { FilterState } from '../../lib/filters'
import { QUARTERS } from '../../lib/quarters'
import type { MatchResult } from '../../models/match'

interface Props {
  matches: MatchResult[]
  best: Quarter
  /** The three months of the chosen quarter. */
  months: HikeMonth[]
  filters: FilterState
  onQuarter: (q: Quarter) => void
}

const status = (r: FitRow) => (r.state === 'ok' ? 'ok' : r.state === 'past' ? 'warn' : 'none')

export function FitSection({ matches, best, months, filters, onQuarter }: Props) {
  const sel = QUARTERS[filters.q - 1]
  const selMatch = matches[filters.q - 1]
  const rows = fitRows(selMatch, months, filters)
  const anyLimit = rows.some((r) => r.limit !== null)
  return (
    <section aria-labelledby="fit-h">
      <h2 id="fit-h">Which quarter fits you?</h2>
      <div className="qcards" role="group" aria-label="Quarter">
        {QUARTERS.map(({ q, label, months: m }, i) => (
          <button key={q} type="button" className={`qcard${filters.q === q ? ' sel' : ''}`} aria-pressed={filters.q === q} onClick={() => onQuarter(q)}>
            <b>{label}</b><span>{m}</span>
            <strong className={matches[i].greyed ? 'out' : ''}>{Math.round(matches[i].match)}%<span className="sr-only"> match</span></strong>
            {matches[i].greyed && <small className="past">Past a limit</small>}
            {q === best && <em>Best fit</em>}
            {matches[i].hasClosedMonth && <small>Has a closed month</small>}
          </button>
        ))}
      </div>

      <div className="fitbox">
        <h3>{sel.label} ({sel.months}) in detail <span className="fine">· typical values from past years, not a forecast</span></h3>
        <ul className="fitrows">
          {rows.map((r) => (
            <li key={r.key} className={`fitrow ${r.state}`}>
              <div className="fr-head">
                <StatusIcon status={status(r)} />
                <span className="fr-label">{r.label}</span>
                <span className="fr-note">{r.note}</span>
              </div>
              <div className="fr-nums">
                <span>Typical <b>{r.value}</b></span>
                <span>{r.limit ? <>Your limit <b>{r.limit}</b></> : 'No limit set'}</span>
              </div>
              <div className="fr-bar" role="img" aria-label={r.score === null ? `${r.label}: not counted in the match` : `${r.label}: ${r.score} percent fit`}>
                {r.score !== null && <i style={{ width: `${Math.max(r.score, 2)}%` }} />}
              </div>
            </li>
          ))}
        </ul>
        <p className="fine">
          Match % = how well {sel.label}'s typical conditions fit your limits. A full bar is inside your limit; a short bar is past it.
          {!anyLimit && ' You have not set any limits yet, so every hike matches 100%. Set some on the map.'}
          {selMatch.skipped.length > 0 && ` Left out of the match for missing data: ${selMatch.skipped.join(', ')}.`}
        </p>
      </div>
    </section>
  )
}
