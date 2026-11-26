// "When" (v2): the answer sentence, four quarter cards (match %, one "why" line in words) aligned over their three
// columns of ONE month chart, hazard chips, a "Show as table" toggle and the sources. The quarter lives in the URL (`q`);
// the picked month is the page's linked selection (useSelection), and picking a month in another quarter moves the quarter too.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Hike, HikeMonth, Quarter } from '../../data/schema'
import { Icon } from '../../components/Icon'
import { MonthChart } from '../../components/charts/MonthChart'
import { MonthStrip } from '../../components/charts/MonthStrip'
import type { FilterState } from '../../lib/filters'
import { stripColumns } from '../../lib/monthStrip'
import { QUARTERS, quarterOfMonth } from '../../lib/quarters'
import { hazardChips, quarterWhy, whenAnswer } from '../../lib/when'
import type { MatchResult } from '../../models/match'
import { useSelection } from './selectionContext'
import '../../styles/when.css'

interface Props {
  matches: MatchResult[]
  best: Quarter
  /** The three months of the chosen quarter. */
  months: HikeMonth[]
  filters: FilterState
  onQuarter: (q: Quarter) => void
  /** The hike, for the chart and its sources. Without it (and `year`) only the cards show. */
  hike?: Hike
  /** All 12 typical months of the hike. */
  year?: HikeMonth[]
  /** Typical trip total per quarter, to tag the best quarter "cheapest" too. */
  costs?: (number | null)[]
}

export function FitSection({ matches, best, months, filters, onQuarter, hike, year, costs }: Props) {
  const { month, setMonth } = useSelection()
  const [table, setTable] = useState(false)
  const cards = useRef<(HTMLButtonElement | null)[]>([])
  // a month in another quarter: move the quarter first, then pick the month once the new quarter is in place
  const pending = useRef<number | null>(null)
  useEffect(() => {
    const m = pending.current
    if (m !== null && quarterOfMonth(m) === filters.q) { pending.current = null; setMonth(m) }
  }, [filters.q, setMonth])
  const onMonth = (m: number | null) => {
    if (m !== null && quarterOfMonth(m) !== filters.q) { pending.current = m; onQuarter(quarterOfMonth(m)) } else setMonth(m)
  }

  const quarters = year ? QUARTERS.map(({ monthNumbers }) => year.filter((m) => monthNumbers.includes(m.month))) : QUARTERS.map(({ q }) => (q === filters.q ? months : []))
  const answer = year ? whenAnswer(matches, quarters, best, filters) : null
  const known = costs?.filter((c): c is number => c != null) ?? []
  const cheapest = known.length > 0 && costs?.[best - 1] === Math.min(...known)
  const chips = year ? hazardChips(year, filters.units) : []

  const onCardKey = (e: KeyboardEvent, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : e.key === 'Home' ? 0 : e.key === 'End' ? 3 : null
    if (to !== null) { e.preventDefault(); cards.current[to]?.focus() }
  }

  return (
    <section aria-labelledby="fit-h" className="when">
      <div className="when-head">
        <p className="when-eyebrow">When</p>
        <h2 id="fit-h">{answer?.title ?? 'Which quarter fits you?'}</h2>
        {answer && <p className="when-ans">{answer.answer}</p>}
      </div>
      <div className="when-card">
        <div className="when-q" role="group" aria-label="Pick a quarter">
          {QUARTERS.map(({ q, label, months: m, season }, i) => {
            const r = matches[i]
            const why = quarters[i].length ? quarterWhy(r, quarters[i], filters) : null
            const on = filters.q === q
            return (
              <button
                key={q}
                ref={(el) => { cards.current[i] = el }}
                type="button"
                className={`wq${on ? ' on' : ''}${r.greyed ? ' off' : ''}`}
                aria-pressed={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onQuarter(q)}
                onKeyDown={(e) => onCardKey(e, i)}
              >
                <span className="wq-top">
                  <b>{label} {m.replace('–', ' to ')}</b>
                  {q === best ? <span className="wq-tag">{cheapest ? 'Best, cheapest' : 'Best fit'}</span> : <span>{season[0].toUpperCase() + season.slice(1)}</span>}
                </span>
                <span className="wq-num">{Math.round(r.match)}%<span className="sr-only"> match</span></span>
                {why && <span className="wq-why">{why.why}</span>}
                {why?.leftOut && <span className="wq-why wq-muted">{why.leftOut}</span>}
                {r.hasClosedMonth && <span className="wq-why wq-hz"><Icon name="alert" size={14} />Has a closed month</span>}
                <span className="wq-meter" aria-hidden="true"><i style={{ width: `${Math.max(r.match, 2)}%` }} /></span>
              </button>
            )
          })}
        </div>

        {chips.length > 0 && (
          <ul className="when-hz" aria-label="Hazards, typical in past years">
            {chips.map((c) => <li key={c.key}><Icon name="alert" size={14} />{c.text}</li>)}
          </ul>
        )}

        {hike && year && (table
          ? <MonthStrip columns={stripColumns(year, filters, filters.units)} chosenLabel={QUARTERS[filters.q - 1].label} />
          : <MonthChart year={year} q={filters.q} limit={filters.temp} units={filters.units} heatMonths={chips.find((c) => c.key === 'heat')?.months ?? []} month={month} onMonth={onMonth} hikeName={hike.name} />)}

        {hike && year && (
          <div className="when-foot">
            <p className="fine">
              Typical, past years (2015 to 2024, without 2020), not a forecast.{' '}
              {hike.station ? `Weather: NOAA GHCN-Daily, station ${hike.station.name}, ${hike.station.dist_km.toFixed(1)} km away.` : 'Weather: no NOAA GHCN-Daily station within 50 km, so temperature and rain are left out.'}{' '}
              Crowds: NPS IRMA, park level. Smoke: EPA AirData, {hike.aqi_county.name}. <Link to="/about">About the data</Link>
            </p>
            <button type="button" className="when-btn" aria-expanded={table} onClick={() => setTable((t) => !t)}>{table ? 'Show as chart' : 'Show as table'}</button>
          </div>
        )}
      </div>
    </section>
  )
}
