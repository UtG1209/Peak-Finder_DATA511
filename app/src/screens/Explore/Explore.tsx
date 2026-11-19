// Explore: filter rail | map. Starter built to the 29 Oct prototype look so lane 3 can extend it.
// Lane 3 (docs/work/lane-3-explore.md) adds: wheel picker, share link, metric toggle, list/map polish, tests.
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { costFor, travelFor } from '../../data/loaders'
import { CITIES } from '../../lib/cities'
import { bestRelaxation, countFitting, evaluate } from '../../lib/explore'
import { DIFFICULTIES, RANGES, type Difficulty } from '../../lib/filters'
import { reasonRows } from '../../lib/reasons'
import { useFilters } from '../../lib/useFilters'
import { QUARTERS } from '../../lib/quarters'
import { quarterValues, travelHours } from '../../models/match'
import { tripCost } from '../../models/cost'
import { HikeCard } from '../../components/HikeCard'
import { GuideOverlay, NextTip, type NavStep } from '../../components/Navigator'
import { DIFFICULTY_COLORS, DIFFICULTY_LABEL } from '../../lib/difficulty'
import { RangeSlider } from '../../components/RangeSlider'
import type { MapApi, MapPoint } from '../../components/UsMap'

// MapLibre is ~1 MB: load it as its own chunk so the page shell and filters appear first.
const UsMap = lazy(() => import('../../components/UsMap').then((m) => ({ default: m.UsMap })))

const CROWD_CHIPS: { label: string; value: 0 | 1 | 2 | null }[] = [
  { label: 'Quiet', value: 0 },
  { label: 'Moderate', value: 1 },
  { label: 'Busy', value: 2 },
  { label: 'Any', value: null },
]
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export default function Explore() {
  const { data, index } = useData()
  const navigate = useNavigate()
  const [filters, update, reset] = useFilters()
  const [hoverId, setHoverId] = useState<string | null>(null)
  const apiRef = useRef<MapApi | null>(null)
  // which guide steps the user has touched (the URL only remembers go=1)
  const [touched, setTouched] = useState({ city: false, quarter: false, limits: false })
  const started = filters.go
  const touch = (k: 'city' | 'quarter' | 'limits') => setTouched((t) => (t[k] ? t : { ...t, [k]: true }))
  const change = (k: 'city' | 'quarter' | 'limits', patch: Parameters<typeof update>[0]) => {
    touch(k)
    update(patch)
  }
  const quarter = QUARTERS[filters.q - 1]

  const rows = useMemo(() => evaluate(data, index, filters), [data, index, filters])
  const fitting = countFitting(rows)
  const relax = useMemo(() => (fitting === 0 ? bestRelaxation(data, index, filters) : null), [fitting, data, index, filters])

  // values behind the tiny histograms (all hikes, chosen quarter)
  const dist = useMemo(() => {
    const temp: number[] = [], smoke: number[] = [], wet: number[] = [], travel: number[] = []
    for (const r of rows) {
      const q = quarterValues(r.months)
      if (q.temp !== null) temp.push(q.temp)
      if (q.smoky !== null) smoke.push(q.smoky)
      if (q.wet !== null) wet.push(q.wet)
      const t = travelFor(index, r.hike.id, filters.from)
      if (t) travel.push(travelHours(t))
    }
    return { temp, smoke, wet, travel }
  }, [rows, index, filters.from])

  const points: MapPoint[] = useMemo(
    () => rows.map(({ hike, result, out }) => ({ id: hike.id, name: hike.name, lat: hike.trailhead.lat, lon: hike.trailhead.lon, match: result.match, greyed: out, featured: hike.featured, difficulty: hike.difficulty })),
    [rows],
  )

  const shown = rows.find((r) => r.hike.id === hoverId) ?? rows[0]
  const costLine = useMemo(() => {
    if (!shown || !filters.from) return null
    const row = costFor(index, shown.hike.id, filters.from, filters.q)
    if (!row) return null
    const mode = travelFor(index, shown.hike.id, filters.from)?.default_mode ?? 'fly'
    const total = Math.round(tripCost(row, { travellers: 2, nights: 3, mode }).total / 10) * 10
    return `Typical cost about $${total.toLocaleString()} for 2 people, 3 nights (${mode === 'fly' ? 'flying' : 'driving'}). Past years, not a quote.`
  }, [shown, filters.from, filters.q, index])

  const open = (id: string) => {
    const hike = index.hikeById.get(id)
    const go = () => navigate({ pathname: `/hike/${id}`, search: `?${new URLSearchParams(window.location.hash.split('?')[1] ?? '')}` })
    if (hike && apiRef.current) apiRef.current.flyTo(hike.trailhead.lat, hike.trailhead.lon, go) // zoom first so the jump has a direction
    else go()
  }

  const steps: NavStep[] = [
    { id: 'city', label: 'Pick your home city (or skip)', done: filters.from !== null || touched.city },
    { id: 'quarter', label: 'Choose the quarter you can travel', done: touched.quarter },
    { id: 'limits', label: 'Set what you can live with: heat, crowds, smoke, rain', done: touched.limits || filters.temp !== null || filters.crowd !== null || filters.smoke !== null || filters.rain !== null || filters.travel !== null },
  ]
  const tempText = filters.temp ? `${filters.temp[0]}–${filters.temp[1]}°F` : 'Any'
  const noCity = filters.from === null

  return (
    <div className="explore">
      <aside className="rail" aria-label="Filters and ranked hikes">
        <div className="brand">Peak Finder <span className="tag">Beta</span></div>

        <section className="group">
          <h2><span className="stepno">1</span> Where are you starting?</h2>
          <select className="select" aria-label="Home city" value={filters.from ?? ''} onChange={(e) => change('city', { from: e.target.value || null })}>
            <option value="">Skip</option>
            {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </section>

        <section className="group">
          <h2><span className="stepno">2</span> When are you going?</h2>
          <div className="qrow">
            {QUARTERS.map(({ q, label, months }) => (
              <button key={q} type="button" className="q" aria-pressed={filters.q === q} onClick={() => change('quarter', { q })}>
                <b>{label}</b><span>{months}</span>
              </button>
            ))}
          </div>
          <div className="hintline">Typical values from past years. 3D walks open on {cap(quarter.season)}.</div>
        </section>

        <section className="group">
          <h2><span className="stepno">3</span> What do you need?</h2>
          <RangeSlider
            label="Typical daytime high" unitLabel="degrees Fahrenheit" valueText={tempText} anyActive={!filters.temp}
            min={RANGES.temp[0]} max={RANGES.temp[1]} value={filters.temp ?? [RANGES.temp[0], RANGES.temp[1]]} histogram={dist.temp}
            onChange={(v) => { const [lo, hi] = v as [number, number]; change('limits', { temp: lo === RANGES.temp[0] && hi === RANGES.temp[1] ? null : [lo, hi] }) }}
          />
          <div className="ctl">
            <div className="ctl-h"><span>Crowds (busiest you accept)</span><span className={`val${filters.crowd === null ? ' off' : ''}`}>{filters.crowd === null ? 'Any' : cap(CROWD_CHIPS[filters.crowd].label)}</span></div>
            <div className="fits" role="group" aria-label="Busiest crowd level you will accept" style={{ marginTop: 8 }}>
              {CROWD_CHIPS.map((c) => <button key={c.label} type="button" className="fit" aria-pressed={filters.crowd === c.value} onClick={() => change('limits', { crowd: c.value })}>{c.label}</button>)}
            </div>
          </div>
          <RangeSlider
            label="Smoky days in the quarter" unitLabel="smoky days" valueText={filters.smoke === null ? 'Any' : `up to ${filters.smoke}`} anyActive={filters.smoke === null}
            min={0} max={RANGES.smoke[1]} value={filters.smoke ?? RANGES.smoke[1]} histogram={dist.smoke} spoken={(v) => (v >= RANGES.smoke[1] ? 'any number of smoky days' : `up to ${v} smoky days`)}
            onChange={(v) => change('limits', { smoke: (v as number) >= RANGES.smoke[1] ? null : (v as number) })}
          />
          <RangeSlider
            label="Wet days in the quarter" unitLabel="wet days" valueText={filters.rain === null ? 'Any' : `up to ${filters.rain}`} anyActive={filters.rain === null}
            min={0} max={RANGES.rain[1]} value={filters.rain ?? RANGES.rain[1]} histogram={dist.wet} spoken={(v) => (v >= RANGES.rain[1] ? 'any number of wet days' : `up to ${v} wet days`)}
            onChange={(v) => change('limits', { rain: (v as number) >= RANGES.rain[1] ? null : (v as number) })}
          />
          <RangeSlider
            label="Max travel time, door to trailhead" unitLabel="hours" valueText={noCity ? 'Pick a city' : filters.travel === null ? 'Any' : `up to ${filters.travel} h`} anyActive={noCity || filters.travel === null}
            min={1} max={RANGES.travel[1]} value={filters.travel ?? RANGES.travel[1]} histogram={dist.travel} disabled={noCity} note={noCity ? 'Pick a home city to use this' : undefined}
            spoken={(v) => (v >= RANGES.travel[1] ? 'any travel time' : `up to ${v} hours`)}
            onChange={(v) => change('limits', { travel: (v as number) >= RANGES.travel[1] ? null : (v as number) })}
          />
          <div className="fits" role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((d: Difficulty) => (
              <button key={d} type="button" className="fit" aria-pressed={filters.diff.includes(d)} onClick={() => change('limits', { diff: filters.diff.includes(d) ? filters.diff.filter((x) => x !== d) : [...filters.diff, d] })}><i className="dd" style={{ background: DIFFICULTY_COLORS[d] }} />{DIFFICULTY_LABEL[d]}</button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={filters.has3d} onChange={(e) => change('limits', { has3d: e.target.checked })} /><span>Only hikes with a 3D walk ({data.hikes.filter((h) => h.featured).length})</span></label>
        </section>

        {!started && (
          <button type="button" className="go rail-go" onClick={() => update({ go: true })}>Show hikes <span aria-hidden="true">→</span></button>
        )}

        <section className="group" hidden={!started}>
          <h2>Hikes that fit</h2>
          {fitting === 0 && (
            <p className="empty hintline">
              No hike fits all your limits.{' '}
              {relax ? <>Allowing {relax.label} adds {relax.gain}. <button type="button" className="linkbtn" style={{ minHeight: 0 }} onClick={() => update(relax.patch)}>Allow it</button></> : 'Try the nearest misses below.'}
            </p>
          )}
          <ol className="ranked">
            {rows.map(({ hike, result, out }) => (
              <li key={hike.id} className={hoverId === hike.id ? 'hot' : ''} onMouseEnter={() => setHoverId(hike.id)} onMouseLeave={() => setHoverId(null)}>
                <button type="button" onClick={() => open(hike.id)} aria-label={`${hike.name}, ${hike.park_name}, ${Math.round(result.match)} percent match${out ? ', past a limit' : ''}`}>
                  <span className="name">{hike.name}{hike.featured && <em title="Has a 3D walk">3D</em>}</span>
                  <span className="park"><i className="dd" style={{ background: DIFFICULTY_COLORS[hike.difficulty] }} />{hike.park_name} · {DIFFICULTY_LABEL[hike.difficulty]}</span>
                  <span className={`pct${out ? ' out' : ''}`}>{Math.round(result.match)}%</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="linkbtn" onClick={reset}>Reset filters</button>
        </section>
        <p className="fine">Sample numbers while the pipeline is built. Match % = how well a hike's typical conditions fit your limits.</p>
      </aside>

      <main id="mapPane" className={started ? '' : 'blurred'}>
        <Suspense fallback={<div className="us-map" aria-busy="true" />}>
          <UsMap points={points} highlightId={hoverId} onSelect={open} onHover={setHoverId} apiRef={apiRef} />
        </Suspense>
        <GuideOverlay steps={steps} started={started} onStart={() => update({ go: true })} />
        {started && <div id="count" className="pill"><b>{fitting}</b> <span>of {rows.length} hikes fit in {quarter.label}</span></div>}
        {started && <NextTip visible={filters.q > 0 && !hoverId} />}
        {started && shown && (
          <HikeCard
            hike={shown.hike} quarterLabel={quarter.label} match={shown.result.match} fits={!shown.out}
            rows={reasonRows(shown.result, shown.months)} costLine={costLine} onOpen={() => open(shown.hike.id)}
          />
        )}
        {started && (
          <div id="legend" className="pill">
            <div className="lg-title">Difficulty (colour) · match (size)</div>
            {(['easy', 'moderate', 'hard'] as const).map((d) => <div key={d}><i className="lg-fit" style={{ background: DIFFICULTY_COLORS[d], boxShadow: `0 0 0 4px ${DIFFICULTY_COLORS[d]}40` }} /> {DIFFICULTY_LABEL[d]}</div>)}
            <div><i className="lg-out" /> Filtered out</div>
            <div><i className="lg-ring" /> 3D walk ready</div>
          </div>
        )}
        {started && <div id="hint" className="pill">Scroll to zoom · drag to pan · click a bubble</div>}
        <div id="zoomctl" hidden={!started}>
          <button type="button" className="zb txt" onClick={() => apiRef.current?.fit(rows.filter((r) => !r.out).map((r) => r.hike.trailhead).map((t) => ({ lat: t.lat, lon: t.lon })))}>Zoom to results</button>
          <button type="button" className="zb" aria-label="Zoom in" onClick={() => apiRef.current?.zoomIn()}>+</button>
          <button type="button" className="zb" aria-label="Zoom out" onClick={() => apiRef.current?.zoomOut()}>−</button>
          <button type="button" className="zb txt" onClick={() => apiRef.current?.wholeUs()}>Whole US</button>
        </div>
      </main>
    </div>
  )
}
