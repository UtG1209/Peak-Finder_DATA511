// MINIMAL Explore screen, enough to prove data -> models -> map works and deploys.
// Lane 3 (docs/work/lane-3-explore.md) replaces the rail, list and map interactions.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { quarterMonths, travelFor } from '../../data/loaders'
import { CITIES } from '../../lib/cities'
import { toLimits } from '../../lib/filters'
import { useFilters } from '../../lib/useFilters'
import { QUARTERS } from '../../lib/quarters'
import { computeMatch } from '../../models'
import { UsMap, type MapPoint } from '../../components/UsMap'

const CROWD_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '0', label: 'Quiet' },
  { value: '1', label: 'Moderate' },
  { value: '2', label: 'Busy' },
]

export default function Explore() {
  const { data, index } = useData()
  const navigate = useNavigate()
  const [filters, update, reset] = useFilters()
  const [hoverId, setHoverId] = useState<string | null>(null)
  const limits = toLimits(filters)

  const rows = useMemo(
    () =>
      data.hikes
        .map((h) => {
          const result = computeMatch(quarterMonths(index, h.id, filters.q), travelFor(index, h.id, filters.from), limits)
          return { hike: h, result }
        })
        // list rows: hikes that pass the difficulty / 3D filters
        .filter(({ hike }) => (!filters.diff.length || filters.diff.includes(hike.difficulty)) && (!filters.has3d || hike.featured))
        .sort((a, b) => Number(a.result.greyed) - Number(b.result.greyed) || b.result.match - a.result.match || a.hike.name.localeCompare(b.hike.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.hikes, index, filters.q, filters.from, filters.diff, filters.has3d, filters.temp, filters.crowd, filters.smoke, filters.rain, filters.travel],
  )

  const points: MapPoint[] = rows.map(({ hike, result }) => ({
    id: hike.id, name: hike.name, lat: hike.trailhead.lat, lon: hike.trailhead.lon,
    match: result.match, greyed: result.greyed, featured: hike.featured,
  }))
  const fitting = rows.filter((r) => !r.result.greyed).length
  const open = (id: string) => navigate({ pathname: `/hike/${id}`, search: window.location.hash.split('?')[1] ? `?${window.location.hash.split('?')[1]}` : '' })

  return (
    <div className="explore">
      <aside className="rail" aria-label="Filters">
        <h1 className="brand">Peak Finder</h1>
        <label className="field">
          <span>Home city</span>
          <select value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || null })}>
            <option value="">Skip</option>
            {CITIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend>Quarter</legend>
          <div className="chips">
            {QUARTERS.map(({ q, label, months }) => (
              <button key={q} type="button" className="chip" aria-pressed={filters.q === q} onClick={() => update({ q })}>
                <b>{label}</b>
                <span>{months}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Crowds (max)</span>
          <select value={filters.crowd === null ? '' : String(filters.crowd)} onChange={(e) => update({ crowd: e.target.value === '' ? null : (Number(e.target.value) as 0 | 1 | 2) })}>
            {CROWD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend>Typical daytime high (°F)</legend>
          <div className="pair">
            <input type="number" aria-label="Lowest comfortable high, °F" placeholder="any" value={filters.temp?.[0] ?? ''} onChange={(e) => update({ temp: e.target.value === '' ? null : [Number(e.target.value), filters.temp?.[1] ?? 110] })} />
            <span>to</span>
            <input type="number" aria-label="Highest comfortable high, °F" placeholder="any" value={filters.temp?.[1] ?? ''} onChange={(e) => update({ temp: e.target.value === '' ? null : [filters.temp?.[0] ?? 0, Number(e.target.value)] })} />
          </div>
        </fieldset>

        <button type="button" className="link" onClick={reset}>Reset filters</button>
        <p className="fine">Starter screen. Real sliders, histograms, wheel and empty states are lane 3.</p>
      </aside>

      <main className="stage">
        <div className="stage-top">
          <strong>{fitting}</strong> of {rows.length} hikes fit {QUARTERS[filters.q - 1].label} ({QUARTERS[filters.q - 1].months})
          <span className="legend"><i className="dot fit" /> Fits your filters <i className="dot out" /> Filtered out</span>
        </div>
        <UsMap points={points} highlightId={hoverId} onSelect={open} onHover={setHoverId} />
      </main>

      <section className="list" aria-label="Ranked hikes">
        <h2>Ranked hikes</h2>
        <ol>
          {rows.map(({ hike, result }) => (
            <li key={hike.id} className={hoverId === hike.id ? 'hot' : ''} onMouseEnter={() => setHoverId(hike.id)} onMouseLeave={() => setHoverId(null)}>
              <button type="button" onClick={() => open(hike.id)}>
                <span className="name">{hike.name}{hike.featured && <em title="Has a 3D walk"> 3D</em>}</span>
                <span className="park">{hike.park_name}</span>
                <span className={`pct${result.greyed ? ' grey' : ''}`}>{Math.round(result.match)}%</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
