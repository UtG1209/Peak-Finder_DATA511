// Hike page (When and How much): header, which quarter fits you, month by month, on the trail (elevation profile with time), what it costs.
// Lane 4 (docs/work/lane-4-hike-page-about.md) built the fit, month strip, timed profile and About; the design pass gave them the tokens and look.
// Still to come: similar hikes (after G3).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Icon } from '../../components/Icon'
import { costFor, quarterMonths, travelFor } from '../../data/loaders'
import type { Quarter } from '../../data/schema'
import { CITIES } from '../../lib/cities'
import { toLimits } from '../../lib/filters'
import { usd } from '../../lib/money'
import { QUARTERS } from '../../lib/quarters'
import { useFilters } from '../../lib/useFilters'
import { walkUrl } from '../../lib/walks'
import { bestQuarter, computeMatch } from '../../models/match'
import { tripCost, type TravelMode } from '../../models/cost'
import { CostBars } from '../../components/charts/CostBars'
import { MonthStrip } from '../../components/charts/MonthStrip'
import { PART_LABEL, type Part } from '../../lib/costParts'
import { stripColumns } from '../../lib/monthStrip'
import { AdviceCard } from './AdviceCard'
import { FitSection } from './FitSection'
import { HikeHeader } from './HikeHeader'
import { TrailSection } from './TrailSection'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export default function Hike() {
  const { id } = useParams()
  const { data, index } = useData()
  const [filters, update] = useFilters()
  const hike = id ? index.hikeById.get(id) : undefined

  const [travellers, setTravellers] = useState(2)
  const [nights, setNights] = useState(3)
  const [modePick, setModePick] = useState<TravelMode | null>(null)
  const [active, setActive] = useState<{ q: Quarter; part: Part } | null>(null)
  // a new page: put keyboard and screen-reader focus on its title, so Tab starts at the top of this page and the change is announced
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [id])

  const backTo = { pathname: '/', search: `?${new URLSearchParams(window.location.hash.split('?')[1] ?? '').toString()}` }
  const limits = toLimits(filters)
  const travel = hike ? travelFor(index, hike.id, filters.from) : null
  const mode: TravelMode = modePick ?? travel?.default_mode ?? 'fly'

  const matches = useMemo(
    () => (hike ? QUARTERS.map(({ q }) => computeMatch(quarterMonths(index, hike.id, q), travel, limits)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hike, index, travel, filters.temp, filters.crowd, filters.smoke, filters.rain, filters.travel],
  )
  const costs = useMemo(
    () => QUARTERS.map(({ q }) => {
      const row = hike && filters.from ? costFor(index, hike.id, filters.from, q) : null
      return row ? tripCost(row, { travellers, nights, mode }) : null
    }),
    [hike, index, filters.from, travellers, nights, mode],
  )

  const byQuarter = useMemo(() => (hike ? QUARTERS.map(({ q }) => quarterMonths(index, hike.id, q)) : []), [hike, index])

  if (!hike) {
    return (
      <main className="page">
        <Link to={backTo} className="back"><Icon name="arrow-left" />Back to map</Link>
        <h1>We could not find that hike</h1>
      </main>
    )
  }

  const best = (bestQuarter(matches.map((m) => m.match), costs.map((c) => c?.total ?? null)) + 1) as Quarter
  const sel = QUARTERS[filters.q - 1]
  const advice = data.advice.find((a) => a.hike_id === hike.id)
  const cheapest = costs.reduce<{ q: Quarter; total: number } | null>((b, c, i) => (c && (!b || c.total < b.total) ? { q: (i + 1) as Quarter, total: c.total } : b), null)
  const selCost = costs[filters.q - 1]
  const saving = cheapest && selCost && cheapest.q !== filters.q ? selCost.total - cheapest.total : 0
  const activeLines = active && costs[active.q - 1] && active.part !== 'buffer' ? costs[active.q - 1]!.lines[active.part] : null
  const row = filters.from ? costFor(index, hike.id, filters.from, filters.q) : null

  return (
    <main className="hikepage">
      <div className="hp-top"><Link to={backTo} className="back"><Icon name="arrow-left" />Back to map</Link><ThemeToggle /></div>

      <HikeHeader hike={hike} units={filters.units} walkHref={hike.featured ? walkUrl(hike, sel.season) : null} seasonLabel={sel.season} titleRef={title} />

      <FitSection matches={matches} best={best} months={byQuarter[filters.q - 1]} filters={filters} onQuarter={(q) => update({ q })} />

      <section aria-labelledby="months-h" className="monthsec">
        <h2 id="months-h">Month by month</h2>
        <MonthStrip columns={stripColumns(byQuarter.flat(), filters, filters.units)} chosenLabel={sel.label} />
        {advice && <AdviceCard advice={advice} />}
      </section>

      <TrailSection hike={hike} quarterMonths={byQuarter} q={filters.q} units={filters.units} onQuarter={(q) => update({ q })} />

      <section aria-labelledby="cost-h" className="costsec">
        <h2 id="cost-h">What it costs</h2>
        <div className="cost-controls">
          <label>Home city
            <select className="select" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || null })}>
              <option value="">Pick a city</option>
              {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </label>
          <div className="field">
            <span id="trav-l">Travellers</span>
            <span className="stepper" role="group" aria-labelledby="trav-l">
              <button type="button" aria-label="Fewer travellers" disabled={travellers <= 1} onClick={() => setTravellers((t) => clamp(t - 1, 1, 12))}><Icon name="minus" /></button>
              <output aria-label={`${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}`}>{travellers}</output>
              <button type="button" aria-label="More travellers" disabled={travellers >= 12} onClick={() => setTravellers((t) => clamp(t + 1, 1, 12))}><Icon name="plus" /></button>
            </span>
          </div>
          <div className="field">
            <span id="nights-l">Nights</span>
            <span className="stepper" role="group" aria-labelledby="nights-l">
              <button type="button" aria-label="Fewer nights" disabled={nights <= 0} onClick={() => setNights((n) => clamp(n - 1, 0, 21))}><Icon name="minus" /></button>
              <output aria-label={`${nights} ${nights === 1 ? 'night' : 'nights'}`}>{nights}</output>
              <button type="button" aria-label="More nights" disabled={nights >= 21} onClick={() => setNights((n) => clamp(n + 1, 0, 21))}><Icon name="plus" /></button>
            </span>
          </div>
          <div className="field">
            <span id="mode-l">Getting there</span>
            <span className="seg2" role="group" aria-labelledby="mode-l">
              {(['fly', 'drive'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setModePick(m)}>{m === 'fly' ? 'Fly' : 'Drive'}{travel && travel.default_mode === m ? ' (shorter)' : ''}</button>
              ))}
            </span>
          </div>
        </div>

        {!filters.from ? (
          <p className="empty-cost">Pick a home city above to see the typical cost for each quarter.</p>
        ) : (
          <>
            <p className="verdict" aria-live="polite">
              {selCost && <>Typical for <b>{sel.label}</b>: <b>{usd(selCost.total)}</b> for {travellers} {travellers === 1 ? 'person' : 'people'}, {nights} {nights === 1 ? 'night' : 'nights'}. </>}
              {cheapest && <>Cheapest quarter: <b>Q{cheapest.q}</b> ({usd(cheapest.total)}){saving > 0 ? `, ${usd(saving)} less than ${sel.label}` : ''}.</>}
            </p>
            <div className="costgrid">
              <div>
                <CostBars costs={costs} selectedQuarter={filters.q} bestQuarter={best} onSelectQuarter={(q) => update({ q })} onSelectPart={(q, part) => setActive({ q, part })} onClear={() => setActive(null)} active={active} />
              </div>
              <aside className="costdetail" aria-live="polite" onKeyDown={(e) => { if (e.key === 'Escape') setActive(null) }}>
                {active && costs[active.q - 1] ? (
                  <>
                    <div className="cd-head"><h3>{PART_LABEL[active.part]}, Q{active.q}</h3><button type="button" className="icon-btn" aria-label="Close details" onClick={() => setActive(null)}><Icon name="close" /></button></div>
                    {active.part === 'buffer' ? (
                      <p>A fixed 15% on top of everything else, for the unexpected. {usd(costs[active.q - 1]!.buffer)} here.</p>
                    ) : (
                      <ul>
                        {activeLines?.map((l) => {
                          const src = data.meta.cost_sources[l.source]
                          return (
                            <li key={l.label}>
                              <span>{l.label}</span><b>{usd(l.amount)}</b>
                              {src && <small>Source: {src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.label}</a> : src.label}. {src.detail}</small>}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <h3>Pick a part of a bar</h3>
                    <p>Click or press Enter on a segment to see its line items and where each number comes from.</p>
                    {row && <p className="fine">{mode === 'fly' ? `Flight fare used: ${usd(row.fare_one_way)} one way.` : `Drive: ${row.drive_mi.toLocaleString()} mi each way.`}</p>}
                  </>
                )}
              </aside>
            </div>
          </>
        )}
        <p className="fine">Typical, from past data. Not a price quote.</p>
      </section>

      <p className="fine hp-foot">Every number on this page is typical, from past years (not a forecast or a price quote). <Link to="/about">How the numbers are made: About the data</Link>.</p>
    </main>
  )
}
