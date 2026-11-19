// Hike page (When and How much). Built so far: header, quarter fit cards, and the cost graph.
// Lane 4 (docs/work/lane-4-hike-page-about.md) adds: month-by-month strip, timed elevation profile, similar hikes, About.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { costFor, quarterMonths, travelFor } from '../../data/loaders'
import type { Quarter } from '../../data/schema'
import { CITIES } from '../../lib/cities'
import { DIFFICULTY_COLORS, DIFFICULTY_LABEL } from '../../lib/difficulty'
import { toLimits } from '../../lib/filters'
import { usd } from '../../lib/money'
import { QUARTERS } from '../../lib/quarters'
import { useFilters } from '../../lib/useFilters'
import { bestQuarter, computeMatch } from '../../models/match'
import { tripCost, type TravelMode } from '../../models/cost'
import { CostBars, CostLegend } from '../../components/charts/CostBars'
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
        <Link to={backTo}>← Back to map</Link>
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
      <div className="hp-top"><Link to={backTo} className="back">← Back to map</Link></div>

      <header className="hp-head">
        <img src={`${import.meta.env.BASE_URL}${hike.photo.file}`} alt={`${hike.name} (placeholder image)`} />
        <div>
          <div className="diff-tag big"><i style={{ background: DIFFICULTY_COLORS[hike.difficulty] }} /> {DIFFICULTY_LABEL[hike.difficulty]}{hike.featured ? ' · 3D walk ready' : ''}</div>
          <h1>{hike.name}</h1>
          <p className="sub">{hike.park_name}, {hike.state}</p>
          <p className="desc">{hike.description}</p>
          <dl className="facts">
            <div><dt>Length (NPS)</dt><dd>{hike.length_mi} mi <small>{hike.length_type}</small></dd></div>
            <div><dt>Elevation gain</dt><dd>{hike.gain_ft.toLocaleString()} ft</dd></div>
            <div><dt>Highest point</dt><dd>{hike.max_elev_ft.toLocaleString()} ft</dd></div>
          </dl>
          {hike.permit_note && <p className="note-line">Permit: {hike.permit_note}</p>}
          {hike.closure_note && <p className="note-line warn">Closure: {hike.closure_note}</p>}
          <div className="hp-actions">
            {hike.featured && <button type="button" className="go" disabled title="Lane 2 connects the 3D walk and the cloud transition">Walk it in 3D <span aria-hidden="true">→</span></button>}
          </div>
        </div>
      </header>

      <section aria-labelledby="fit-h">
        <h2 id="fit-h">Which quarter fits you?</h2>
        <div className="qcards" role="group" aria-label="Quarter">
          {QUARTERS.map(({ q, label, months }, i) => (
            <button key={q} type="button" className={`qcard${filters.q === q ? ' sel' : ''}`} aria-pressed={filters.q === q} onClick={() => update({ q })}>
              <b>{label}</b><span>{months}</span>
              <strong className={matches[i].greyed ? 'out' : ''}>{Math.round(matches[i].match)}%</strong>
              {q === best && <em>Best fit</em>}
              {matches[i].hasClosedMonth && <small>Has a closed month</small>}
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
          <label>Travellers
            <span className="stepper"><button type="button" aria-label="Fewer travellers" onClick={() => setTravellers((t) => clamp(t - 1, 1, 12))}>−</button><output>{travellers}</output><button type="button" aria-label="More travellers" onClick={() => setTravellers((t) => clamp(t + 1, 1, 12))}>+</button></span>
          </label>
          <label>Nights
            <span className="stepper"><button type="button" aria-label="Fewer nights" onClick={() => setNights((n) => clamp(n - 1, 0, 21))}>−</button><output>{nights}</output><button type="button" aria-label="More nights" onClick={() => setNights((n) => clamp(n + 1, 0, 21))}>+</button></span>
          </label>
          <fieldset className="modes"><legend>Getting there</legend>
            {(['fly', 'drive'] as const).map((m) => (
              <button key={m} type="button" className="fit" aria-pressed={mode === m} onClick={() => setModePick(m)}>{m === 'fly' ? 'Fly' : 'Drive'}{travel && travel.default_mode === m ? ' (shorter)' : ''}</button>
            ))}
          </fieldset>
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
                <CostBars costs={costs} selectedQuarter={filters.q} bestQuarter={best} onSelectQuarter={(q) => update({ q })} onSelectPart={(q, part) => setActive({ q, part })} active={active} />
                <CostLegend />
              </div>
              <aside className="costdetail" aria-live="polite">
                {active && costs[active.q - 1] ? (
                  <>
                    <h3>{PART_LABEL[active.part]} · Q{active.q}</h3>
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
                    <h3>Click a bar segment</h3>
                    <p>See its line items and where each number comes from.</p>
                    {row && <p className="fine">{mode === 'fly' ? `Flight fare used: ${usd(row.fare_one_way)} one way.` : `Drive: ${row.drive_mi.toLocaleString()} mi each way.`}</p>}
                  </>
                )}
              </aside>
            </div>
          </>
        )}
        <p className="fine">Typical, from past data. Not a price quote.</p>
      </section>

      <section className="coming" aria-label="Coming next">
        <div><h2>Month by month</h2><p className="fine">Coming from lane 4: 12-month strip of typical high, crowds, smoky days, wet days and daylight.</p></div>
        <div><h2>On the trail</h2><p className="fine">Coming from lane 4: elevation profile with clock times at each checkpoint, a time scrubber and a daylight band.</p></div>
      </section>
    </main>
  )
}
