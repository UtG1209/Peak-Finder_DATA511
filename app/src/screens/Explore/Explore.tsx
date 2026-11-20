// Explore: filter rail | map. Starter built to the 29 Oct prototype look so lane 3 can extend it.
// Lane 3 (docs/work/lane-3-explore.md) adds: wheel picker, share link, metric toggle, list/map polish, tests.
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { ThemeToggle } from '../../components/ThemeToggle'
import { costFor, quarterMonths, travelFor } from '../../data/loaders'
import { CITIES } from '../../lib/cities'
import { bestRelaxation, countFitting, evaluate } from '../../lib/explore'
import { DIFFICULTIES, RANGES, toLimits, type Difficulty } from '../../lib/filters'
import { reasonRows } from '../../lib/reasons'
import { useFilters } from '../../lib/useFilters'
import { QUARTERS } from '../../lib/quarters'
import { computeMatch, quarterValues, travelHours } from '../../models/match'
import { tripCost } from '../../models/cost'
import { HikeCard } from '../../components/HikeCard'
import { GuideOverlay, NextTip, type NavStep } from '../../components/Navigator'
import { DIFFICULTY_LABEL } from '../../lib/difficulty'
import { Icon } from '../../components/Icon'
import { FLIP_EASE, FLIP_MS, flipDeltas } from '../../lib/flip'
import { RangeSlider } from '../../components/RangeSlider'
import type { MapApi, MapPoint } from '../../components/UsMap'
import type { Quarter } from '../../data/schema'
import { useMinWidth, webglAvailable } from './view3d/webgl'
import { MapControls } from '../../components/MapControls'
import { MapBoundary } from '../../components/MapBoundary'

// MapLibre is ~1 MB: load it as its own chunk so the page shell and filters appear first.
const UsMap = lazy(() => import('../../components/UsMap').then((m) => ({ default: m.UsMap })))

// The opt-in 3D view (three.js) and its dashboard are their own chunks, fetched only after the user switches to 3D.
const View3D = lazy(() => import('./view3d/View3D').then((m) => ({ default: m.View3D })))
const Dashboard = lazy(() => import('../../components/charts/dash/Dashboard').then((m) => ({ default: m.Dashboard })))

const CROWD_CHIPS: { label: string; value: 0 | 1 | 2 | null }[] = [
  { label: 'Quiet', value: 0 },
  { label: 'Moderate', value: 1 },
  { label: 'Busy', value: 2 },
  { label: 'Any', value: null },
]
/** Legend marker: the same flat peak the map draws, coloured with the theme's CSS variables. */
const Peak = ({ kind }: { kind: 'easy' | 'moderate' | 'hard' | 'out' | 'walk' }) => (
  <svg className={`peakicon pk-${kind}`} width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
    <path d="M8 1.5 L14.5 12.5 H1.5 Z" strokeLinejoin="round" />
  </svg>
)
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export default function Explore() {
  const { data, index } = useData()
  const navigate = useNavigate()
  const [filters, update, reset] = useFilters()
  const [hoverId, setHoverId] = useState<string | null>(null)
  // phone: the ranked list is a bottom sheet (bar only / a few rows / nearly full height); the filters open as a full-height sheet
  const [sheet, setSheet] = useState<'collapsed' | 'peek' | 'expanded'>(() => (filters.pick ? 'collapsed' : 'peek'))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersBtn = useRef<HTMLButtonElement | null>(null)
  const filtersDone = useRef<HTMLButtonElement | null>(null)
  const dragY = useRef<number | null>(null)
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
  const webgl = webglAvailable()
  const wide = useMinWidth(861) // phone and tablet layout (bottom sheet, 2D only) at 860 px and below, same as the CSS
  const is3d = filters.view === '3d' && webgl && wide // 2D map is the default and the fallback

  const rows = useMemo(() => evaluate(data, index, filters), [data, index, filters])
  const fitting = countFitting(rows)
  // FLIP re-sort: remember where each row was, and slide it from there when quarter or filters change the order.
  const listRef = useRef<HTMLOListElement | null>(null)
  const prevTops = useRef<Map<string, number> | null>(null)
  const orderKey = rows.map((r) => r.hike.id).join(',')
  useLayoutEffect(() => {
    const ol = listRef.current
    if (!ol || ol.offsetParent === null) { prevTops.current = null; return }
    const tops = new Map<string, number>()
    const els = new Map<string, HTMLElement>()
    ol.querySelectorAll<HTMLElement>('li[data-id]').forEach((li) => { tops.set(li.dataset.id!, li.offsetTop); els.set(li.dataset.id!, li) })
    const before = prevTops.current
    prevTops.current = tops
    if (!before || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const [id, d] of flipDeltas(before, tops)) {
      els.get(id)?.animate?.([{ transform: `translateY(${d}px)` }, { transform: 'translateY(0)' }], { duration: FLIP_MS, easing: FLIP_EASE })
    }
  }, [orderKey, started])
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

  const dashMatches = useMemo(() => {
    if (!is3d || !shown) return []
    const limits = toLimits(filters)
    const travel = travelFor(index, shown.hike.id, filters.from)
    return ([1, 2, 3, 4] as Quarter[]).map((q) => computeMatch(quarterMonths(index, shown.hike.id, q), travel, limits).match)
  }, [is3d, shown, filters, index])

  const pick = (id: string) => {
    const hike = index.hikeById.get(id)
    update({ pick: id })
    setSheet('collapsed') // phone: tuck the list away so the tile and the map are visible
    if (hike) apiRef.current?.flyTo(hike.trailhead.lat, hike.trailhead.lon, undefined, 5.5)
  }
  const closeTile = () => update({ pick: null })
  useEffect(() => {
    if (!picked) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') update({ pick: null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, update])

  const filtersSheet = !wide && filtersOpen
  const wasOpen = useRef(false)
  // focus moves into the filters sheet when it opens and back to the Filters button when it closes (after the page behind it is no longer inert)
  useEffect(() => {
    if (filtersSheet) filtersDone.current?.focus()
    else if (wasOpen.current) filtersBtn.current?.focus()
    wasOpen.current = filtersSheet
  }, [filtersSheet])
  useEffect(() => {
    if (!filtersSheet) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersSheet])
  const closeFilters = () => setFiltersOpen(false)
  const sheetNext = { collapsed: 'peek', peek: 'expanded', expanded: 'collapsed' } as const
  const sheetLabel = { collapsed: 'Show the ranked list', peek: 'Expand the ranked list', expanded: 'Collapse the ranked list' }[sheet]
  const onSheetPointer = (e: React.PointerEvent, phase: 'down' | 'up') => {
    if (phase === 'down') { dragY.current = e.clientY; return }
    if (dragY.current === null) return
    const d = e.clientY - dragY.current
    dragY.current = null
    if (Math.abs(d) < 40) return
    const order = ['collapsed', 'peek', 'expanded'] as const
    const i = order.indexOf(sheet)
    setSheet(order[Math.max(0, Math.min(2, i + (d < 0 ? 1 : -1)))])
  }
  const activeLimits = [filters.temp, filters.crowd, filters.smoke, filters.rain, filters.travel].filter((v) => v !== null).length + (filters.diff.length > 0 && filters.diff.length < DIFFICULTIES.length ? 1 : 0) + (filters.has3d ? 1 : 0)

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
    <div className={`explore sheet-${sheet}${filtersSheet ? ' filters-open' : ''}`}>
      <aside className="rail" aria-label="Filters and ranked hikes">
        <div className="brand" inert={filtersSheet}>
          <h1 className="wordmark">Peak Finder</h1>
          <button ref={filtersBtn} type="button" className="back m-only" aria-haspopup="dialog" aria-expanded={filtersSheet} onClick={() => setFiltersOpen(true)}>
            <Icon name="sliders" size={18} /> Filters{activeLimits > 0 && <span className="badge">{activeLimits}</span>}
          </button>
          <ThemeToggle />
        </div>

        <div className="rail-filters" role={wide ? undefined : 'dialog'} aria-modal={wide ? undefined : true} aria-label={wide ? undefined : 'Filters'} inert={!wide && !filtersOpen}>
        <div className="fs-head m-only">
          <h2>Filters</h2>
          <button ref={filtersDone} type="button" className="icon-btn" aria-label="Close filters" onClick={closeFilters}><Icon name="close" /></button>
        </div>

        <section className="group">
          <h2>Home city</h2>
          <select className="select" aria-label="Home city" value={filters.from ?? ''} onChange={(e) => change('city', { from: e.target.value || null })}>
            <option value="">Skip</option>
            {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
        </section>

        <section className="group">
          <h2>Quarter</h2>
          <div className="qrow">
            {QUARTERS.map(({ q, label, months }) => (
              <button key={q} type="button" className="q" aria-pressed={filters.q === q} onClick={() => change('quarter', { q })}>
                <b>{label}</b><span>{months}</span>
              </button>
            ))}
          </div>
          <p className="hintline">Typical values from past years. 3D walks open in {cap(quarter.season)}.</p>
        </section>

        <section className="group">
          <h2>Limits</h2>
          <RangeSlider
            label="Typical daytime high" unitLabel="degrees Fahrenheit" valueText={tempText} anyActive={!filters.temp}
            min={RANGES.temp[0]} max={RANGES.temp[1]} value={filters.temp ?? [RANGES.temp[0], RANGES.temp[1]]} histogram={dist.temp}
            onChange={(v) => { const [lo, hi] = v as [number, number]; change('limits', { temp: lo === RANGES.temp[0] && hi === RANGES.temp[1] ? null : [lo, hi] }) }}
          />
          <div className="ctl">
            <div className="ctl-h"><span>Busiest crowds you accept</span><span className={`val${filters.crowd === null ? ' off' : ''}`}>{filters.crowd === null ? 'Any' : cap(CROWD_CHIPS[filters.crowd].label)}</span></div>
            <div className="fits" role="group" aria-label="Busiest crowd level you will accept">
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
          <div className="ctl-h"><span>Difficulty</span></div>
          <div className="fits" role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((d: Difficulty) => (
              <button key={d} type="button" className="fit" aria-pressed={filters.diff.includes(d)} onClick={() => change('limits', { diff: filters.diff.includes(d) ? filters.diff.filter((x) => x !== d) : [...filters.diff, d] })}><i className={`dd d-${d}`} />{DIFFICULTY_LABEL[d]}</button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={filters.has3d} onChange={(e) => change('limits', { has3d: e.target.checked })} /><span>Only hikes with a 3D walk ({data.hikes.filter((h) => h.featured).length})</span></label>
        </section>

        {!started && (
          <button type="button" className="go rail-go" onClick={() => update({ go: true })}>Show hikes <Icon name="arrow-right" /></button>
        )}
        {!started && (
          <div className="ghost" aria-hidden="true">
            <div className="ghost-cap">Ranked hikes appear here</div>
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ghost-row"><i /><i /></div>)}
          </div>
        )}

        <div className="fs-foot m-only">
          <button type="button" className="go" onClick={() => { if (!started) update({ go: true }); closeFilters() }}>{started ? `Show ${fitting} hike${fitting === 1 ? '' : 's'}` : 'Show hikes'}</button>
        </div>
        </div>

        <section className="group rail-list" hidden={!started} aria-labelledby="sheet-title" inert={filtersSheet}>
          <div className="sheet-head" onPointerDown={(e) => onSheetPointer(e, 'down')} onPointerUp={(e) => onSheetPointer(e, 'up')} onPointerCancel={() => { dragY.current = null }}>
            <span className="sheet-grip m-only" aria-hidden="true" />
            <h2 id="sheet-title">Hikes that fit <span className="h2-n">{fitting} of {rows.length}</span></h2>
            <button type="button" className="icon-btn sheet-btn m-only" aria-expanded={sheet !== 'collapsed'} aria-controls="sheet-body" aria-label={sheetLabel} onClick={() => setSheet(sheetNext[sheet])}>
              <Icon name={sheet === 'expanded' ? 'chevron-down' : 'chevron-up'} />
            </button>
          </div>
          <div className="sheet-body" id="sheet-body">
          {fitting === 0 && (
            <div className="empty">
              <p><b>No hike fits all your limits.</b> {relax ? <>Allowing {relax.label} adds {relax.gain}.</> : 'The nearest misses are listed below.'}</p>
              {relax && <button type="button" className="allow" onClick={() => update(relax.patch)}>Allow it</button>}
            </div>
          )}
          <ol className="ranked" ref={listRef}>
            {rows.map(({ hike, result, out }) => (
              <li key={hike.id} data-id={hike.id} className={`${hoverId === hike.id ? 'hot' : ''}${filters.pick === hike.id ? ' sel' : ''}`} onMouseEnter={() => setHoverId(hike.id)} onMouseLeave={() => setHoverId(null)}>
                <button type="button" aria-pressed={filters.pick === hike.id} onClick={() => pick(hike.id)}>
                  <span className="name">{hike.name}{hike.featured && <em title="Has a 3D walk"><Icon name="walk3d" size={12} />3D walk</em>}</span>
                  <span className="park"><i className={`dd d-${hike.difficulty}`} />{hike.park_name} · {DIFFICULTY_LABEL[hike.difficulty]}</span>
                  <span className={`pct${out ? ' out' : ''}`}>{Math.round(result.match)}%<span className="sr-only"> match{out ? ', past a limit' : ''}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="linkbtn" onClick={reset}>Reset filters</button>
          <p className="fine">Match % is how well a hike's typical conditions, from past years, fit your limits.</p>
          </div>
        </section>
      </aside>

      <main id="mapPane" className={`${started ? '' : 'blurred'}${is3d ? ' v3d' : ''}`.trim()} inert={filtersSheet} aria-label="Map of hikes">
        {is3d ? (
          <Suspense fallback={<div className="v3d-scene" aria-busy="true" />}>
            <View3D points={points} hoverId={hoverId} pickedId={picked?.hike.id ?? null} onHover={setHoverId} onSelect={pick} />
            {shown && <Dashboard hikeName={shown.hike.name} matches={dashMatches} months={index.months.get(shown.hike.id) ?? []} quarter={filters.q} />}
          </Suspense>
        ) : (
          <Suspense fallback={<div className="us-map" aria-busy="true" />}>
            <MapBoundary>
              <UsMap points={points} highlightId={hoverId ?? picked?.hike.id ?? null} onSelect={pick} onHover={setHoverId} apiRef={apiRef} />
            </MapBoundary>
          </Suspense>
        )}
        <GuideOverlay steps={steps} started={started} onStart={() => update({ go: true })} onFilters={() => setFiltersOpen(true)} />
        {started && (
          <div className="map-top">
            <div id="count" className="pill"><b>{fitting}</b> <span>of {rows.length} hikes fit in {quarter.label}</span></div>
            <div className="viewtoggle" role="group" aria-label="Map view">
              <button type="button" aria-pressed={!is3d} onClick={() => update({ view: '2d' })}>2D map</button>
              <button type="button" aria-pressed={is3d} disabled={!webgl} onClick={() => update({ view: '3d' })}>3D view</button>
              {!webgl && <span className="vt-note">3D view needs WebGL</span>}
            </div>
            <NextTip visible={filters.q > 0 && !hoverId} />
          </div>
        )}
        {started && shown && (
          <HikeCard
            hike={shown.hike} quarterLabel={quarter.label} match={shown.result.match} fits={!shown.out}
            rows={reasonRows(shown.result, shown.months)} costLine={costLine} onOpen={() => open(shown.hike.id)}
            selected={picked?.hike.id === shown.hike.id} onClose={closeTile}
          />
        )}
        {started && (
          <div id="legend" className="pill">
            <div className="lg-title">How to read the map</div>
            <div className="lg-group">
              {(['easy', 'moderate', 'hard'] as const).map((d) => <div key={d}><Peak kind={d} /> {DIFFICULTY_LABEL[d]}</div>)}
              <div className="lg-note">Colour is difficulty. A bigger peak is a better match.</div>
            </div>
            <div><Peak kind="out" /> Filtered out</div>
            <div><Peak kind="walk" /> 3D walk ready</div>
            <div className="lg-hint">Scroll to zoom, drag to pan. Click a peak to preview it.</div>
          </div>
        )}
        <MapControls apiRef={apiRef} hidden={!started || is3d} resultPoints={() => rows.filter((r) => !r.out).map((r) => ({ lat: r.hike.trailhead.lat, lon: r.hike.trailhead.lon }))} />
      </main>
    </div>
  )
}
