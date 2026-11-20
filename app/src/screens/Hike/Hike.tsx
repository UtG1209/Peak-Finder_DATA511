// Hike page (When and How much). Built so far: header, quarter fit strip, and the cost graph.
// Month by month, the timed elevation profile and similar hikes are shown as calm "coming soon" frames until they land (docs/work/lane-4-hike-page-about.md).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Icon } from '../../components/Icon'
import { costFor, quarterMonths, travelFor } from '../../data/loaders'
import type { Quarter } from '../../data/schema'
import { CITIES } from '../../lib/cities'
import { DIFFICULTY_LABEL } from '../../lib/difficulty'
import { toLimits } from '../../lib/filters'
import { usd } from '../../lib/money'
import { QUARTERS } from '../../lib/quarters'
import { useFilters } from '../../lib/useFilters'
import { walkUrl } from '../../lib/walks'
import { bestQuarter, computeMatch } from '../../models/match'
import { tripCost, type TravelMode } from '../../models/cost'
import { CostBars } from '../../components/charts/CostBars'
import { PART_LABEL, type Part } from '../../lib/costParts'

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
  const selMatch = matches[filters.q - 1]
  const cheapest = costs.reduce<{ q: Quarter; total: number } | null>((b, c, i) => (c && (!b || c.total < b.total) ? { q: (i + 1) as Quarter, total: c.total } : b), null)
  const selCost = costs[filters.q - 1]
  const saving = cheapest && selCost && cheapest.q !== filters.q ? selCost.total - cheapest.total : 0
  const activeLines = active && costs[active.q - 1] && active.part !== 'buffer' ? costs[active.q - 1]!.lines[active.part] : null
  const row = filters.from ? costFor(index, hike.id, filters.from, filters.q) : null

  return (
    <main className="hikepage">
      <div className="hp-top"><Link to={backTo} className="back"><Icon name="arrow-left" />Back to map</Link><ThemeToggle /></div>

      <header className="hp-head">
        <figure className="hp-photo">
          <img src={`${import.meta.env.BASE_URL}${hike.photo.file}`} alt={`${hike.name}, ${hike.park_name}`} />
          <figcaption>
            Photo: {hike.photo.author}, {hike.photo.license_url ? <a href={hike.photo.license_url} target="_blank" rel="noreferrer">{hike.photo.license}</a> : hike.photo.license}
            {hike.photo.page && <> · <a href={hike.photo.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></>}
          </figcaption>
        </figure>
        <div className="hp-intro">
          <p className="eyebrow">{hike.park_name}, {hike.state}</p>
          <h1 ref={title} tabIndex={-1}>{hike.name}</h1>
          <p className="desc">{hike.description}</p>
          <dl className="facts">
            <div><dt>Length (NPS)</dt><dd>{hike.length_mi} <small>mi, {hike.length_type}</small></dd></div>
            <div><dt>Gain</dt><dd>{hike.gain_ft.toLocaleString()} <small>ft</small></dd></div>
            <div><dt>Highest point</dt><dd>{hike.max_elev_ft.toLocaleString()} <small>ft</small></dd></div>
            <div><dt>Difficulty</dt><dd className="diffval"><Icon name="peak" size={18} className={`peak-${hike.difficulty}`} /> {DIFFICULTY_LABEL[hike.difficulty]}</dd></div>
          </dl>
          {hike.permit_note && <p className="note-line"><b>Permit.</b> {hike.permit_note}</p>}
          {hike.closure_note && <p className="note-line warn"><Icon name="alert" size={16} /><span><b>Closure.</b> {hike.closure_note}</span></p>}
          {hike.gear.length > 0 && <p className="note-line"><b>Know before you go.</b> {hike.gear.map((g) => g.replace(/-/g, ' ')).join(', ')}.</p>}
          {hike.featured && walkUrl(hike, sel.season) && (
            <div className="hp-actions">
              {/* Plain link for now (opens the finished walk on the season of the chosen quarter); the cloud transition wraps it later. */}
              <a className="go" href={walkUrl(hike, sel.season)!}><Icon name="walk3d" />Walk it in 3D<Icon name="arrow-right" /></a>
            </div>
          )}
        </div>
      </header>

      <section aria-labelledby="fit-h">
        <h2 id="fit-h">Which quarter fits you?</h2>
        <div className="qcards" role="group" aria-label="Quarter">
          {QUARTERS.map(({ q, label, months }, i) => (
            <button key={q} type="button" className={`qcard${filters.q === q ? ' sel' : ''}`} aria-pressed={filters.q === q} onClick={() => update({ q })}>
              <span className="qhead"><b>{label}</b><span>{months}</span></span>
              <strong className={matches[i].greyed ? 'out' : ''}>{Math.round(matches[i].match)}<small>%</small></strong>
              <span className="qnote">
                {q === best && <em><Icon name="peak" size={14} />Best fit</em>}
                {matches[i].greyed && <span className="muted"><Icon name="dash" size={14} />Outside a limit</span>}
                {matches[i].hasClosedMonth && <small><Icon name="alert" size={14} />Has a closed month</small>}
              </span>
            </button>
          ))}
        </div>
        <p className="fine">Match % = how well {sel.label}'s typical conditions fit your limits (from past years; not a forecast). {selMatch.skipped.length ? `Left out for missing data: ${selMatch.skipped.join(', ')}.` : ''}</p>
      </section>

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

      <section className="soon" aria-labelledby="month-h">
        <h2 id="month-h">Month by month</h2>
        <p>Typical high, crowds, smoky days, wet days and daylight for each month. Coming soon.</p>
      </section>

      <section className="soon" aria-labelledby="trail-h">
        <h2 id="trail-h">On the trail</h2>
        <p>An elevation profile with the clock time you reach each stop, and whether you finish before dark. Coming soon.</p>
      </section>
    </main>
  )
}
