// "How much" (v2): the answer sentence, the stacked bars with direct labels, the line-item popover, and the "What if" panel with live deltas.
// Split out of Hike.tsx (Plan 5b step 1). The trip state stays in Hike because the best quarter depends on it.
import { useState } from 'react'
import { useData } from '../../data/DataContext'
import { CostBars } from '../../components/charts/CostBars'
import { Icon } from '../../components/Icon'
import { costFor } from '../../data/loaders'
import type { Quarter, Travel } from '../../data/schema'
import { CITIES } from '../../lib/cities'
import { PART_LABEL, type Part } from '../../lib/costParts'
import { costAnswer, whatIf } from '../../lib/costWhatIf'
import type { FilterState } from '../../lib/filters'
import { usd } from '../../lib/money'
import type { TravelMode, TripCost } from '../../models/cost'
import './cost.css'

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
  const activeLines = active && costs[active.q - 1] && active.part !== 'buffer' ? costs[active.q - 1]!.lines[active.part] : null
  const row = filters.from ? costFor(index, hikeId, filters.from, filters.q) : null
  const answer = filters.from ? costAnswer(costs, filters.q) : null
  const deltas = row ? whatIf(row, { travellers, nights, mode }, travel) : []
  const src = data.meta.cost_sources
  // Esc closes the popover and hands focus back to the segment that opened it.
  const close = () => {
    const seg = active && document.querySelector<SVGGElement>(`.costbars .seg[data-seg="${active.q}-${active.part}"]`)
    setActive(null)
    seg?.focus()
  }
  const hrs = (m: TravelMode) => (travel ? `, ${(m === 'fly' ? travel.fly_drive_hr : travel.drive_hr).toFixed(1)} h` : '')
  const srcLink = (k: keyof typeof src) => (src[k].url ? <a href={src[k].url} target="_blank" rel="noreferrer">{src[k].label}</a> : src[k].label)

  return (
    <section aria-labelledby="cost-h" className="costsec">
      <div className="cost-sh">
        <p className="eyebrow">How much</p>
        <h2 id="cost-h">{answer ? answer.title : 'What it costs'}</h2>
        {answer && <p className="cost-ans" aria-live="polite">{answer.detail} A typical trip from past years, for {travellers} {travellers === 1 ? 'traveller' : 'travellers'} and {nights} {nights === 1 ? 'night' : 'nights'}.</p>}
      </div>
      <div className="cost-grid">
        <div className="cost-card">
          {!filters.from ? (
            <p className="empty-cost">Pick a home city in the What if panel to see the typical cost for each quarter.</p>
          ) : (
            <>
              <CostBars costs={costs} selectedQuarter={filters.q} bestQuarter={best} onSelectQuarter={(q) => update({ q })} onSelectPart={(q, part) => setActive({ q, part })} onClear={() => setActive(null)} active={active} />
              <p className="cost-cap">
                Click a segment for its line items and source. Fares: {srcLink('fare')}. Lodging and meals: {srcLink('lodging')}. Gas: {srcLink('gas')}. Fees: {srcLink('fees')}. {src.assumed.detail.replace(/\.$/, '')}: {src.assumed.label.toLowerCase()}.
              </p>
              <aside className="costdetail" aria-live="polite" onKeyDown={(e) => { if (e.key === 'Escape') close() }}>
                {active && costs[active.q - 1] ? (
                  <>
                    <div className="cd-head"><h3>{PART_LABEL[active.part]}, Q{active.q} <span className="cd-amt">{usd(costs[active.q - 1]![active.part])}</span></h3><button type="button" className="icon-btn" aria-label="Close details" onClick={close}><Icon name="close" /></button></div>
                    {active.part === 'buffer' ? (
                      <p>A fixed 15% on top of everything else, for the unexpected. {usd(costs[active.q - 1]!.buffer)} here.</p>
                    ) : (
                      <ul>
                        {activeLines?.map((l) => {
                          const s = src[l.source]
                          return (
                            <li key={l.label}>
                              <span>{l.label}</span><b>{usd(l.amount)}</b>
                              {s && <small>Source: {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}. {s.detail}</small>}
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
            </>
          )}
        </div>
        <div className="cost-panel">
          <h3 className="wi-h">What if</h3>
          <label className="wi-field">Home city
            <select className="select" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || null })}>
              <option value="">Pick a city</option>
              {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </label>
          <div className="wi-field">
            <span id="trav-l">Travellers</span>
            <span className="stepper" role="group" aria-labelledby="trav-l">
              <button type="button" aria-label="Fewer travellers" disabled={travellers <= 1} onClick={() => onTravellers(clamp(travellers - 1, 1, 12))}><Icon name="minus" /></button>
              <output aria-label={`${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}`}>{travellers}</output>
              <button type="button" aria-label="More travellers" disabled={travellers >= 12} onClick={() => onTravellers(clamp(travellers + 1, 1, 12))}><Icon name="plus" /></button>
            </span>
          </div>
          <div className="wi-field">
            <span id="nights-l">Nights</span>
            <span className="stepper" role="group" aria-labelledby="nights-l">
              <button type="button" aria-label="Fewer nights" disabled={nights <= 0} onClick={() => onNights(clamp(nights - 1, 0, 21))}><Icon name="minus" /></button>
              <output aria-label={`${nights} ${nights === 1 ? 'night' : 'nights'}`}>{nights}</output>
              <button type="button" aria-label="More nights" disabled={nights >= 21} onClick={() => onNights(clamp(nights + 1, 0, 21))}><Icon name="plus" /></button>
            </span>
          </div>
          <div className="wi-field wi-mode">
            <span id="mode-l">Getting there</span>
            <span className="seg2" role="group" aria-labelledby="mode-l">
              {(['fly', 'drive'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => onMode(m)}>{m === 'fly' ? 'Fly' : 'Drive'}{hrs(m)}{travel && travel.default_mode === m ? ' (shorter)' : ''}</button>
              ))}
            </span>
          </div>
          {deltas.length > 0 && (
            <dl className="wi-delta" aria-live="polite">
              {deltas.map((d) => (
                <div key={d.key}>
                  <dt>{d.label}</dt><dd className="num">{d.value}</dd>
                  {d.note && <dd className="wi-note">{d.note}</dd>}
                </div>
              ))}
            </dl>
          )}
          <p className="fine">Typical, from past data. Not a price quote.</p>
        </div>
      </div>
    </section>
  )
}
