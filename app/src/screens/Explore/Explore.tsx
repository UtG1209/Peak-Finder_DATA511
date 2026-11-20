// Explore: filter rail | map. Starter built to the 29 Oct prototype look so lane 3 can extend it.
// Lane 3 (docs/work/lane-3-explore.md): motion, hover linking, wheel picker, share link, metric toggle, states, accessibility.
import { LayoutGroup, LazyMotion, MotionConfig, m } from 'framer-motion'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { costFor, travelFor } from '../../data/loaders'
import { CITIES, cityByCode } from '../../lib/cities'
import { bestRelaxation, countFitting, evaluate } from '../../lib/explore'
import { DIFFICULTIES, RANGES, serializeFilters, type Difficulty } from '../../lib/filters'
import { reasonRows } from '../../lib/reasons'
import { useFilters } from '../../lib/useFilters'
import { defaultQuarter, QUARTERS } from '../../lib/quarters'
import { fmtLength, fmtTempRange, spokenTemp } from '../../lib/units'
import { wheelRows } from '../../lib/wheel'
import { quarterValues, travelHours } from '../../models/match'
import { tripCost } from '../../models/cost'
import { HikeCard } from '../../components/HikeCard'
import { GuideOverlay, NextTip, type NavStep } from '../../components/Navigator'
import { DIFFICULTY_COLORS, DIFFICULTY_LABEL } from '../../lib/difficulty'
import { RangeSlider } from '../../components/RangeSlider'
import { ShareButton, UnitsToggle } from '../../components/RailTools'
import type { MapApi, MapPoint, MapView } from '../../components/UsMap'

// MapLibre is ~1 MB: load it as its own chunk so the page shell and filters appear first.
const Wheel = lazy(() => import('../../components/Wheel').then((m) => ({ default: m.Wheel }))) // only when someone opens it
const UsMap = lazy(() => import('../../components/UsMap').then((m) => ({ default: m.UsMap })))

const CROWD_CHIPS: { label: string; value: 0 | 1 | 2 | null }[] = [
  { label: 'Quiet', value: 0 },
  { label: 'Moderate', value: 1 },
  { label: 'Busy', value: 2 },
  { label: 'Any', value: null },
]
/** Legend marker: the same flat peak the map draws. */
const Peak = ({ color = 'none', hollow = false, outline }: { color?: string; hollow?: boolean; outline?: string }) => (
  <svg className="peakicon" width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
    <path d="M8 1.5 L14.5 12.5 H1.5 Z" fill={hollow ? 'none' : color} stroke={hollow ? '#7b8791' : outline ?? '#0e1216'} strokeWidth={hollow ? 1.6 : outline ? 1.8 : 1.4} strokeLinejoin="round" />
  </svg>
)
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

// Where the map was looking when the user opened a hike, so Back returns to the same view (not the whole US).
const VIEW_KEY = 'pf-map-view'
const readView = (): MapView | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null')
    return v && Array.isArray(v.center) && Number.isFinite(v.zoom) ? (v as MapView) : null
  } catch {
    return null
  }
}
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Placeholder bubbles while the map chunk loads (the page shell and filters are already usable). */
const MapSkeleton = () => (
  <div className="us-map map-skeleton" aria-busy="true" role="status">
    <span className="sr-only">Loading the map…</span>
    {[[22, 38, 26], [34, 55, 18], [48, 30, 30], [58, 62, 20], [70, 40, 24], [80, 58, 16], [42, 48, 14]].map(([x, y, d], i) => (
      <i key={i} className="sk-bubble" style={{ left: `${x}%`, top: `${y}%`, width: d, height: d }} />
    ))}
  </div>
)

export default function Explore() {
  const { data, index } = useData()
  const navigate = useNavigate()
  const [filters, update, reset] = useFilters()
  const [hoverId, setHoverId] = useState<string | null>(null)
  // Who is hovering decides what moves: a hover on the map scrolls the matching list row into view; a hover on the list must not.
  const hoverFrom = useRef<'map' | 'list'>('list')
  const hover = (id: string | null, from: 'map' | 'list') => {
    hoverFrom.current = from
    setHoverId(id)
  }
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const apiRef = useRef<MapApi | null>(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [initialView] = useState(readView)
  useEffect(() => { sessionStorage.removeItem(VIEW_KEY) }, []) // used once: a later visit starts from the whole US again
  // which guide steps the user has touched (the URL only remembers go=1)
  const [touched, setTouched] = useState({ city: false, quarter: false, limits: false })
  const started = filters.go
  const touch = (k: 'city' | 'quarter' | 'limits') => setTouched((t) => (t[k] ? t : { ...t, [k]: true }))
  const change = (k: 'city' | 'quarter' | 'limits', patch: Parameters<typeof update>[0]) => {
    touch(k)
    update(patch)
  }
  const quarter = QUARTERS[filters.q - 1]

  const units = filters.units
  const rows = useMemo(() => evaluate(data, index, filters), [data, index, filters])
  const wheelHikes = useMemo(
    () => wheelRows(rows).map((r) => ({ id: r.hike.id, name: r.hike.name, park: r.hike.park_name, match: r.result.match, difficulty: r.hike.difficulty })),
    [rows],
  )
  const shareUrl = `${window.location.origin}${window.location.pathname}#/?${serializeFilters({ ...filters, go: true })}`
  useEffect(() => {
    if (hoverFrom.current !== 'map' || !hoverId) return
    rowRefs.current.get(hoverId)?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' })
  }, [hoverId])
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

  // Clicking a peak or a list row only SELECTS it (the tile stays open); the hike page opens from the tile's button.
  const picked = filters.pick ? rows.find((r) => r.hike.id === filters.pick) : undefined
  const shown = rows.find((r) => r.hike.id === hoverId) ?? picked ?? rows[0]
  const costLine = useMemo(() => {
    if (!shown || !filters.from) return null
    const row = costFor(index, shown.hike.id, filters.from, filters.q)
    if (!row) return null
    const mode = travelFor(index, shown.hike.id, filters.from)?.default_mode ?? 'fly'
    const total = Math.round(tripCost(row, { travellers: 2, nights: 3, mode }).total / 10) * 10
    return `Typical cost about $${total.toLocaleString()} for 2 people, 3 nights (${mode === 'fly' ? 'flying' : 'driving'}). Past years, not a quote.`
  }, [shown, filters.from, filters.q, index])

  const pick = (id: string) => {
    const hike = index.hikeById.get(id)
    update({ pick: id })
    if (hike) apiRef.current?.flyTo(hike.trailhead.lat, hike.trailhead.lon, undefined, 5.5)
  }
  const closeTile = () => update({ pick: null })
  useEffect(() => {
    if (!picked) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') update({ pick: null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, update])

  const open = (id: string) => {
    const hike = index.hikeById.get(id)
    // go=1 always: whoever opens a hike has seen the map, and Back must return to an unblurred one
    const go = () => navigate({ pathname: `/hike/${id}`, search: `?${serializeFilters({ ...filters, go: true })}` })
    const view = apiRef.current?.getView()
    if (view) sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)) // remember the view the user is leaving
    setWheelOpen(false)
    if (hike && apiRef.current) apiRef.current.flyTo(hike.trailhead.lat, hike.trailhead.lon, go) // zoom first so the jump has a direction
    else go()
  }

  const steps: NavStep[] = [
    { id: 'city', label: 'Pick your home city (or skip)', done: filters.from !== null || touched.city },
    { id: 'quarter', label: 'Choose the quarter you can travel', done: touched.quarter || filters.q !== defaultQuarter() },
    { id: 'limits', label: 'Set what you can live with: heat, crowds, smoke, rain', done: touched.limits || filters.temp !== null || filters.crowd !== null || filters.smoke !== null || filters.rain !== null || filters.travel !== null },
  ]
  const tempText = filters.temp ? fmtTempRange(filters.temp[0], filters.temp[1], units) : 'Any'
  const noCity = filters.from === null

  return (
    <LazyMotion features={() => import('../../lib/motionFeatures').then((x) => x.default)} strict>
    <MotionConfig reducedMotion="user">
    <div className="explore">
      <aside className="rail" aria-label="Filters and ranked hikes">
        <button type="button" className="skip" onClick={() => document.getElementById('mapPane')?.focus()}>Skip to the map</button>
        <div className="brand">Peak Finder <span className="tag">Beta</span></div>
        <div className="tools">
          <UnitsToggle units={units} onChange={(u) => update({ units: u })} />
          <ShareButton url={shareUrl} />
        </div>

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
            label="Typical daytime high" unitLabel={units === 'metric' ? 'degrees Celsius' : 'degrees Fahrenheit'} spoken={(v) => spokenTemp(v, units)} valueText={tempText} anyActive={!filters.temp}
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
          {fitting === 0 && <h3 className="misses">Nearest misses</h3>}
          <button type="button" className="fit wide" disabled={wheelHikes.length === 0} onClick={() => setWheelOpen(true)}>Not sure? Spin the wheel</button>
          {wheelHikes.length === 0 && <p className="hintline">Nothing fits yet, so there is nothing to spin. Loosen a limit first.</p>}
          <LayoutGroup>
            <ol className="ranked">
              {rows.map(({ hike, result, out }) => (
                <m.li
                  key={hike.id} layout="position" transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                  ref={(el: HTMLLIElement | null) => { if (el) rowRefs.current.set(hike.id, el); else rowRefs.current.delete(hike.id) }}
                  className={`${hoverId === hike.id ? 'hot' : ''}${filters.pick === hike.id ? ' sel' : ''}`}
                  onMouseEnter={() => hover(hike.id, 'list')} onMouseLeave={() => hover(null, 'list')}
                  onFocus={() => hover(hike.id, 'list')} onBlur={() => hover(null, 'list')}
                >
                  <button type="button" aria-pressed={filters.pick === hike.id} onClick={() => pick(hike.id)} aria-label={`${hike.name}, ${hike.park_name}, ${Math.round(result.match)} percent match${out ? ', past a limit' : ''}`}>
                    <span className="name">{hike.name}{hike.featured && <em title="Has a 3D walk">3D</em>}</span>
                    <span className="park"><i className="dd" style={{ background: DIFFICULTY_COLORS[hike.difficulty] }} />{hike.park_name} · {DIFFICULTY_LABEL[hike.difficulty]} · {fmtLength(hike.length_mi, units)}</span>
                    <span className={`pct${out ? ' out' : ''}`}>{Math.round(result.match)}%{out && <small>past a limit</small>}</span>
                  </button>
                </m.li>
              ))}
            </ol>
          </LayoutGroup>
          <button type="button" className="linkbtn" onClick={reset}>Reset filters</button>
        </section>
        <p className="fine">Sample numbers while the pipeline is built. Match % = how well a hike's typical conditions fit your limits. <Link to="/about">About the data</Link></p>
      </aside>

      <main id="mapPane" tabIndex={-1} className={started ? '' : 'blurred'}>
        <Suspense fallback={<MapSkeleton />}>
          <UsMap points={points} home={cityByCode(filters.from)} initialView={initialView} highlightId={hoverId ?? picked?.hike.id ?? null} onSelect={pick} onHover={(id) => hover(id, 'map')} apiRef={apiRef} />
        </Suspense>
        <GuideOverlay steps={steps} started={started} onStart={() => update({ go: true })} onWheel={wheelHikes.length > 0 ? () => setWheelOpen(true) : undefined} />
        {started && <div id="count" className="pill"><b>{fitting}</b> <span>of {rows.length} hikes fit in {quarter.label}</span></div>}
        {started && <NextTip visible={filters.q > 0 && !hoverId} />}
        {started && shown && (
          <HikeCard
            hike={shown.hike} quarterLabel={quarter.label} match={shown.result.match} fits={!shown.out}
            rows={reasonRows(shown.result, shown.months, units)} costLine={costLine} onOpen={() => open(shown.hike.id)} units={units}
            selected={picked?.hike.id === shown.hike.id} onClose={closeTile}
          />
        )}
        {started && (
          <div id="legend" className="pill">
            <div className="lg-title">Difficulty (colour) · match (size)</div>
            {(['easy', 'moderate', 'hard'] as const).map((d) => <div key={d}><Peak color={DIFFICULTY_COLORS[d]} /> {DIFFICULTY_LABEL[d]}</div>)}
            <div><Peak hollow /> Filtered out</div>
            <div><Peak color="#8b949c" outline="#f2efe9" /> 3D walk ready</div>
            <div className="lg-hint">Scroll to zoom · drag to pan. Click a peak to preview it.</div>
          </div>
        )}
        <div id="zoomctl" hidden={!started}>
          <button type="button" className="zb txt" onClick={() => apiRef.current?.fit(rows.filter((r) => !r.out).map((r) => r.hike.trailhead).map((t) => ({ lat: t.lat, lon: t.lon })))}>Zoom to results</button>
          <button type="button" className="zb" aria-label="Zoom in" onClick={() => apiRef.current?.zoomIn()}>+</button>
          <button type="button" className="zb" aria-label="Zoom out" onClick={() => apiRef.current?.zoomOut()}>−</button>
          <button type="button" className="zb txt" onClick={() => apiRef.current?.wholeUs()}>Whole US</button>
        </div>
      </main>
      {wheelOpen && wheelHikes.length > 0 && (
        <Suspense fallback={null}>
          <Wheel hikes={wheelHikes} quarterLabel={quarter.label} onOpen={open} onClose={() => setWheelOpen(false)} />
        </Suspense>
      )}
    </div>
    </MotionConfig>
    </LazyMotion>
  )
}
