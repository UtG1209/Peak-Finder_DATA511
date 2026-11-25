// "What it costs": controls (city, travellers, nights, fly or drive), the stacked bars, and the line-item popover.
// Split out of Hike.tsx (Plan 5b step 1). The trip state stays in Hike because the best quarter depends on it.
import { useState } from 'react'
import { useData } from '../../data/DataContext'
import { CostBars } from '../../components/charts/CostBars'
import { Icon } from '../../components/Icon'
import { costFor } from '../../data/loaders'
import type { Quarter, Travel } from '../../data/schema'
import { CITIES } from '../../lib/cities'
import { PART_LABEL, type Part } from '../../lib/costParts'
import type { FilterState } from '../../lib/filters'
import { usd } from '../../lib/money'
import { QUARTERS } from '../../lib/quarters'
import type { TravelMode, TripCost } from '../../models/cost'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

interface Props {
  hikeId: string
  filters: FilterState
  update: (patch: Partial<FilterState>) => void
  travel: Travel | null
  costs: (TripCost | null)[]
  best: Quarter
  travellers: number
  nights: number
  mode: TravelMode
  onTravellers: (n: number) => void
  onNights: (n: number) => void
  onMode: (m: TravelMode) => void
}

export function CostSection({ hikeId, filters, update, travel, costs, best, travellers, nights, mode, onTravellers, onNights, onMode }: Props) {
  const { data, index } = useData()
  const [active, setActive] = useState<{ q: Quarter; part: Part } | null>(null)
  const sel = QUARTERS[filters.q - 1]
  const cheapest = costs.reduce<{ q: Quarter; total: number } | null>((b, c, i) => (c && (!b || c.total < b.total) ? { q: (i + 1) as Quarter, total: c.total } : b), null)
  const selCost = costs[filters.q - 1]
  const saving = cheapest && selCost && cheapest.q !== filters.q ? selCost.total - cheapest.total : 0
  const activeLines = active && costs[active.q - 1] && active.part !== 'buffer' ? costs[active.q - 1]!.lines[active.part] : null
  const row = filters.from ? costFor(index, hikeId, filters.from, filters.q) : null

  return (
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
            <button type="button" aria-label="Fewer travellers" disabled={travellers <= 1} onClick={() => onTravellers(clamp(travellers - 1, 1, 12))}><Icon name="minus" /></button>
            <output aria-label={`${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}`}>{travellers}</output>
            <button type="button" aria-label="More travellers" disabled={travellers >= 12} onClick={() => onTravellers(clamp(travellers + 1, 1, 12))}><Icon name="plus" /></button>
          </span>
        </div>
        <div className="field">
          <span id="nights-l">Nights</span>
          <span className="stepper" role="group" aria-labelledby="nights-l">
            <button type="button" aria-label="Fewer nights" disabled={nights <= 0} onClick={() => onNights(clamp(nights - 1, 0, 21))}><Icon name="minus" /></button>
            <output aria-label={`${nights} ${nights === 1 ? 'night' : 'nights'}`}>{nights}</output>
            <button type="button" aria-label="More nights" disabled={nights >= 21} onClick={() => onNights(clamp(nights + 1, 0, 21))}><Icon name="plus" /></button>
          </span>
        </div>
        <div className="field">
          <span id="mode-l">Getting there</span>
          <span className="seg2" role="group" aria-labelledby="mode-l">
            {(['fly', 'drive'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => onMode(m)}>{m === 'fly' ? 'Fly' : 'Drive'}{travel && travel.default_mode === m ? ' (shorter)' : ''}</button>
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
  )
}
