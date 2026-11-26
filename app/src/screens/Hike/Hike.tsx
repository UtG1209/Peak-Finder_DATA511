// Hike page (When and How much): header, which quarter fits you, month by month, on the trail (elevation profile with time), what it costs.
// Lane 4 (docs/work/lane-4-hike-page-about.md) built the fit, month strip, timed profile and About; the design pass gave them the tokens and look.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Icon } from '../../components/Icon'
import { costFor, quarterMonths, travelFor } from '../../data/loaders'
import type { Quarter } from '../../data/schema'
import { toLimits } from '../../lib/filters'
import { QUARTERS } from '../../lib/quarters'
import { useFilters } from '../../lib/useFilters'
import { walkUrl } from '../../lib/walks'
import { bestQuarter, computeMatch, quarterValues } from '../../models/match'
import { headline } from '../../models/headline'
import { CITIES } from '../../lib/cities'
import { fmtTemp } from '../../lib/units'
import { tripCost, type TravelMode } from '../../models/cost'
import { AdviceCard } from './AdviceCard'
import { SelectionProvider } from './selection'
import { FitSection } from './FitSection'
import { HikeHeader } from './HikeHeader'
import { SelectionBar } from './SelectionBar'
import { heroStats } from '../../models/heroStats'
import { TrailSection } from './TrailSection'
import CloudTransition from '../../components/CloudTransition'
import { saveWalkReturn } from '../../lib/walkReturn'
import { useWalkReturn } from './useWalkReturn'
import { SimilarHikes } from './SimilarHikes'
import { CostSection } from './CostSection'

export default function Hike() {
  return <SelectionProvider><HikePage /></SelectionProvider>
}

function HikePage() {
  const { id } = useParams()
  const { data, index } = useData()
  const [filters, update] = useFilters()
  const hike = id ? index.hikeById.get(id) : undefined

  const [travellers, setTravellers] = useState(2)
  const [nights, setNights] = useState(3)
  const [modePick, setModePick] = useState<TravelMode | null>(null)
  // a new page: put keyboard and screen-reader focus on its title, so Tab starts at the top of this page and the change is announced
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [id])
  const { openingWalk, setOpeningWalk, returning, setReturnY } = useWalkReturn(id)
  // opening another hike (a Similar hikes card) starts at the top. The page scrolls inside .hikepage, not the window.
  // Coming back from a 3D walk keeps its own saved position instead (useWalkReturn).
  useEffect(() => {
    if (returning) return
    document.querySelector('.hikepage')?.scrollTo(0, 0)
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
  const bestValues = quarterValues(byQuarter[best - 1])
  const answer = headline({
    matches: matches.map((m) => m.match),
    costs: costs.map((c) => c?.total ?? null),
    best,
    anyLimit: Object.values(limits).some((v) => v !== null),
    high: bestValues.temp == null ? null : fmtTemp(bestValues.temp, filters.units),
    smoky: bestValues.smoky,
    city: CITIES.find((c) => c.code === filters.from)?.name ?? null,
  })
  const advice = data.advice.find((a) => a.hike_id === hike.id)
  const walkHref = walkUrl(hike, sel.season, { back: window.location.hash, backname: hike.name })

  return (
    <main className="hikepage">
      <div className="hp-top"><Link to={backTo} className="back"><Icon name="arrow-left" />Back to map</Link><ThemeToggle /></div>

      <HikeHeader
        hike={hike}
        headline={answer}
        units={filters.units}
        walkHref={walkHref}
        seasonLabel={sel.season}
        titleRef={title}
        onWalkStart={() => { saveWalkReturn(window.sessionStorage, hike.id, document.querySelector('.hikepage')?.scrollTop ?? window.scrollY); setOpeningWalk(true) }}
        best={best}
        {...heroStats({ matches: matches.map((m) => m.match), costs: costs.map((c) => c?.total ?? null), best, anyLimit: Object.values(limits).some((v) => v !== null) })}
      />
      <SelectionBar hike={hike} quarterMonths={byQuarter} travellers={travellers} nights={nights} mode={mode} />

      <FitSection matches={matches} best={best} months={byQuarter[filters.q - 1]} filters={filters} onQuarter={(q) => update({ q })} hike={hike} year={byQuarter.flat()} costs={costs.map((c) => c?.total ?? null)} />

      {advice && <AdviceCard advice={advice} />}

      <TrailSection hike={hike} quarterMonths={byQuarter} q={filters.q} units={filters.units} onQuarter={(q) => update({ q })} />

      <CostSection hikeId={hike.id} filters={filters} update={update} travel={travel} costs={costs} best={best} travellers={travellers} nights={nights} mode={mode} onTravellers={setTravellers} onNights={setNights} onMode={setModePick} />

      <SimilarHikes hike={hike} />

      <p className="fine hp-foot">Every number on this page is typical, from past years (not a forecast or a price quote). <Link to="/about">How the numbers are made: About the data</Link>.</p>
      {openingWalk && walkHref && <CloudTransition hikeId={hike.id} season={sel.season} onDone={() => window.location.assign(walkHref)} />}
      {returning && !openingWalk && <CloudTransition direction="out" hikeId={hike.id} season={sel.season} onDone={() => setReturnY(null)} />}
    </main>
  )
}
