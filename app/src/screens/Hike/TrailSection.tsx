// "On the trail" (CLAUDE.md section 2, v2 design in docs/design/hike-page/canvas-v2/Main.dc.html). The answer first ("Back at
// 12:44 pm, long before dark", or an amber chip with the latest start that ends in daylight), then the start time, the elevation
// profile with checkpoint clock times up and back, a time scrubber and the daylight band; beside it the stop card with Back /
// Forward; under it the checkpoint table. The checkpoint in focus is shared with the other blocks via useSelection().
// All timing comes from models/checkpoints.ts (Tobler's hiking function); this file is state and layout.
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { loadProfile } from '../../data/loaders'
import type { Hike, HikeMonth, Profile, Quarter } from '../../data/schema'
import { DaylightBand } from '../../components/charts/DaylightBand'
import { ElevationProfile } from '../../components/charts/ElevationProfile'
import { Icon } from '../../components/Icon'
import { StatusIcon } from '../../components/StatusIcon'
import { MONTH_NAMES, QUARTERS } from '../../lib/quarters'
import { checkpointLabel, daylightVerdict, durationLabel, latestStart, trailCurve, trailHeadline, turnaroundEvent } from '../../lib/trail'
import { distFromM, distUnit, elevFromM, elevUnit, fmtDist, fmtElev, type Units } from '../../lib/units'
import { defaultStartMin, eventIndexAt, finishTime, formatClock, parseClock, positionAt, stepTime, timeAtWalked, timeline } from '../../models/checkpoints'
import { useSelection } from './selectionContext'
import './trail.css'

interface Props {
  hike: Hike
  /** The three months of each quarter, index 0 = Q1. The middle month gives sunrise and sunset. */
  quarterMonths: HikeMonth[][]
  q: Quarter
  units: Units
  onQuarter: (q: Quarter) => void
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const toInput = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min) % 60).padStart(2, '0')}`
const FULL_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const isPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 640px)').matches

type Loaded = { id: string; attempt: number; profile: Profile | null; error: string | null }

export function TrailSection({ hike, quarterMonths, q, units, onQuarter }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    let live = true
    loadProfile(hike.id).then(
      (profile) => live && setLoaded({ id: hike.id, attempt, profile, error: null }),
      (e: unknown) => live && setLoaded({ id: hike.id, attempt, profile: null, error: e instanceof Error ? e.message : 'Unknown error' }),
    )
    return () => { live = false }
  }, [hike.id, attempt])
  const ready = loaded && loaded.id === hike.id && loaded.attempt === attempt ? loaded : null

  return (
    <section aria-labelledby="trail-h" className="trailsec" id="trail">
      {!ready && (
        <>
          <div className="tr-sh"><p className="eyebrow">On the trail</p><h2 id="trail-h">On the trail</h2></div>
          <div className="skeleton-block" aria-busy="true" role="status"><span className="sr-only">Loading the elevation profile…</span></div>
        </>
      )}
      {ready?.error && (
        <>
          <div className="tr-sh"><p className="eyebrow">On the trail</p><h2 id="trail-h">On the trail</h2></div>
          <p className="empty-cost" role="alert">
            We could not load the elevation profile. {ready.error} <button type="button" className="linkbtn" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
          </p>
        </>
      )}
      {ready?.profile && <Trail key={hike.id} hike={hike} profile={ready.profile} quarterMonths={quarterMonths} q={q} units={units} onQuarter={onQuarter} />}
    </section>
  )
}

function Trail({ hike, profile, quarterMonths, q, units, onQuarter }: Props & { profile: Profile }) {
  const roundTrip = hike.route_type === 'out-and-back'
  const mid = quarterMonths[q - 1][1] // the quarter's middle month: its sunrise and sunset stand for the quarter
  const defaultStart = defaultStartMin(mid.sunrise)
  const selection = useSelection()

  const [startOverride, setStartOverride] = useState<number | null>(null)
  const start = startOverride ?? defaultStart
  const [elapsed, setElapsed] = useState(0) // minutes since the start: stays put when the start time or quarter changes
  const [syncedCp, setSyncedCp] = useState<number | null>(null)
  const [photoFailed, setPhotoFailed] = useState<string | null>(null)
  const [tableOpen, setTableOpen] = useState(() => !isPhone())

  const hasCheckpoints = profile.checkpoints.length >= 2 && profile.points.length >= 2
  const tl = useMemo(() => (hasCheckpoints ? timeline(profile, start, roundTrip) : null), [profile, start, roundTrip, hasCheckpoints])
  const curve = useMemo(() => trailCurve(profile, roundTrip), [profile, roundTrip])
  if (!tl) {
    return (
      <>
        <div className="tr-sh"><p className="eyebrow">On the trail</p><h2 id="trail-h">On the trail</h2></div>
        <p className="empty-cost">This hike has no checkpoints yet, so there is no timed profile.</p>
      </>
    )
  }

  const duration = finishTime(tl) - start
  const cpIndexAtElapsed = (el: number) => {
    const i = eventIndexAt(tl, start + clamp(el, 0, duration))
    return profile.checkpoints.findIndex((c) => c.id === tl[Math.max(0, i)].checkpoint.id)
  }
  // another block picked a checkpoint: jump there (its time going up), unless we are already at it
  if (selection.checkpoint !== syncedCp) {
    setSyncedCp(selection.checkpoint)
    const cp = selection.checkpoint === null ? null : profile.checkpoints[selection.checkpoint]
    const e = cp && tl.find((ev) => ev.checkpoint.id === cp.id && ev.dir === 'up')
    if (e && cpIndexAtElapsed(elapsed) !== selection.checkpoint) setElapsed(e.time - start)
  }
  const go = (el: number) => {
    setElapsed(el)
    const i = cpIndexAtElapsed(el)
    setSyncedCp(i)
    if (i !== selection.checkpoint) selection.setCheckpoint(i)
  }

  const el = clamp(elapsed, 0, duration)
  const t = start + el
  const pos = positionAt(tl, t)
  const verdict = daylightVerdict(tl, mid.sunrise, mid.sunset)
  const turn = turnaroundEvent(tl)
  const idx = eventIndexAt(tl, t)
  const here = idx >= 0 ? tl[idx] : tl[0]
  const hereIdx = profile.checkpoints.findIndex((c) => c.id === here.checkpoint.id)
  const atStop = t <= here.time + here.stopMin + 1e-6
  const sel = QUARTERS[q - 1]
  const monthWord = FULL_MONTH[mid.month - 1]
  const step = (dir: 1 | -1) => go(stepTime(tl, t, dir) - start)
  const finished = t >= finishTime(tl) - 1e-6
  const where = finished ? 'Finished' : pos.dir === 'down' ? 'Coming back' : t <= tl[0].time ? 'At the start' : 'Going up'
  const scale = profile.nps_length_m / profile.osm_length_m
  const fromTrailheadM = pos.dist * scale
  const summitWord = roundTrip ? 'the summit' : 'the end of the route'
  const lastCp = profile.checkpoints.length - 1

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Home') { e.preventDefault(); go(0) }
    else if (e.key === 'End') { e.preventDefault(); go(duration) }
  }
  const onSliderKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); go(clamp(el + (e.key === 'PageUp' ? 10 : -10), 0, duration)) }
  }

  // the stop photo: the checkpoint's own (from the 3D walk), else the hike's Commons photo with its credit
  const stopPhoto = here.checkpoint.photo && photoFailed !== here.checkpoint.photo ? here.checkpoint.photo : null
  const walkHref = hike.walk_path ? `${import.meta.env.BASE_URL}${hike.walk_path}index.html` : null
  const hp = hike.photo

  return (
    <>
      <div className="tr-sh trail-verdict" aria-live="polite">
        <p className="eyebrow">On the trail</p>
        <h2 id="trail-h">{trailHeadline(verdict, roundTrip, formatClock)}</h2>
        <p className="tr-ans">
          Start {formatClock(start)}{startOverride === null ? ', an hour after sunrise' : ''} in {monthWord} ({sel.label}'s middle month). Reach {summitWord} at about {formatClock(turn.time)}
          {verdict.finishesAfterSunset
            ? <> and finish {durationLabel(-verdict.marginMin)} after the {formatClock(verdict.sunsetMin)} sunset.</>
            : <> and finish {durationLabel(verdict.marginMin)} before sunset ({formatClock(verdict.sunsetMin)}, typical for past years).</>}
          {' '}{durationLabel(duration)} including stops.
        </p>
        {verdict.finishesAfterSunset
          ? <p className="tr-hz"><StatusIcon status="warn" size={20} /><span><b>After dark:</b> you would finish at {formatClock(verdict.finishMin)}, {durationLabel(-verdict.marginMin)} after sunset. Start by {formatClock(latestStart(verdict))} to be back in daylight, or carry a headlamp.</span></p>
          : <p className="sr-only">Before dark: about {durationLabel(verdict.marginMin)} to spare.</p>}
        {verdict.startsBeforeSunrise && <p className="tr-hz"><StatusIcon status="warn" size={20} /><span><b>Starts before sunrise</b> ({formatClock(verdict.sunriseMin)}): you would be walking in the dark at first.</span></p>}
      </div>

      <div className="tr-grid">
        <div className="tr-card">
          <div className="tr-controls">
            <label className="starttime"><span>Start time</span>
              <input type="time" step={300} value={toInput(start)} onChange={(e) => e.target.value && setStartOverride(parseClock(e.target.value))} />
            </label>
            {startOverride !== null && <button type="button" className="linkbtn" onClick={() => setStartOverride(null)}>Use sunrise + 1 h ({formatClock(defaultStart)})</button>}
            <span className="fine">{roundTrip ? 'Out and back on the same trail. ' : ''}Tobler pace, 10 min at each stop.</span>
          </div>

          <div
            className="chartbox" role="group" tabIndex={0} onKeyDown={onKey}
            aria-label="Elevation profile. Use the left and right arrow keys to step between checkpoints, Home for the start and End for the finish."
          >
            <ElevationProfile
              curve={curve} events={tl} pos={pos} nowMin={t} units={units} hikeName={hike.name} currentEvent={atStop ? idx : -1}
              onScrub={(w) => go(timeAtWalked(tl, w) - start)} timeAt={(w) => timeAtWalked(tl, w)}
            />
          </div>

          <label className="scrub-range">
            <span className="fine">Time on the trail: {formatClock(t)}, {durationLabel(el)} after the start</span>
            <input
              type="range" min={0} max={Math.ceil(duration)} step={1} value={Math.round(el)}
              onChange={(e) => go(Number(e.target.value))} onKeyDown={onSliderKey}
              aria-valuetext={`${formatClock(t)}, ${where.toLowerCase()}, ${fmtDist(pos.walkedM, units)} walked, elevation ${fmtElev(pos.elev / 0.3048, units)}`}
            />
          </label>

          <DaylightBand verdict={verdict} nowMin={t} monthLabel={MONTH_NAMES[mid.month - 1]} />
        </div>

        <aside className="readout tr-panel" aria-label="Where you are at this time">
          <figure className="tr-photo">
            {stopPhoto
              ? <img src={`${import.meta.env.BASE_URL}${stopPhoto}`} alt={`${here.checkpoint.name}, on ${hike.name}`} loading="lazy" onError={() => setPhotoFailed(stopPhoto)} />
              : <img src={`${import.meta.env.BASE_URL}${hp.file}`} alt={`${hike.name}, ${hike.park_name}`} loading="lazy" />}
            <figcaption className="fine">
              {stopPhoto
                ? <>Photo from this hike's 3D walk, Wikimedia Commons; {walkHref ? <a href={walkHref}>credits on the walk page</a> : 'credits on the walk page'}.</>
                : <>Photo: {hp.author} · {hp.license_url ? <a href={hp.license_url} target="_blank" rel="noreferrer">{hp.license}</a> : hp.license}{hp.page && <> · <a href={hp.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></>}</>}
            </figcaption>
          </figure>
          <div className="ro-stop" aria-live="polite">
            <span className="eyebrow">Checkpoint {hereIdx} of {lastCp}, {atStop ? (here.dir === 'up' ? 'going up' : 'coming back') : 'last passed'}</span>
            <h3>{checkpointLabel(here.checkpoint.id)} {here.checkpoint.name}</h3>
          </div>
          <dl className="ro-facts">
            <div className="ro-time"><dt className="sr-only">Time</dt><dd><b>{formatClock(t)}</b><span>{where}</span></dd></div>
            <div><dt>Elapsed</dt><dd>{durationLabel(el)}</dd></div>
            <div><dt>From the trailhead</dt><dd>{fmtDist(fromTrailheadM, units)}</dd></div>
            <div><dt>Elevation, terrain</dt><dd>{fmtElev(pos.elev / 0.3048, units)}</dd></div>
          </dl>
          <div className="scrub">
            <button type="button" className="tr-btn" onClick={() => step(-1)} disabled={el <= 0}><Icon name="arrow-left" size={20} />Back</button>
            <button type="button" className="tr-btn pri" onClick={() => step(1)} disabled={el >= duration}>Forward<Icon name="arrow-right" size={20} /></button>
          </div>
          <p className="ro-next fine">
            {pos.nextCheckpoint ? <>Next: <b>{checkpointLabel(pos.nextCheckpoint.checkpoint.id)} {pos.nextCheckpoint.checkpoint.name}</b>, {formatClock(pos.nextCheckpoint.time)}. Arrow keys on the profile step checkpoints.</> : 'You have finished the route.'}
          </p>
        </aside>
      </div>

      <details className="tr-table" open={tableOpen} onToggle={(e) => setTableOpen(e.currentTarget.open)}>
        <summary>Checkpoints and times</summary>
        <div className="strip-scroll" tabIndex={0} role="region" aria-label="Checkpoint times table, scrolls sideways on small screens">
          <table className="cptable">
            <caption>Times are typical for an average pace (Tobler), scaled to the NPS length. Profile elevations come from terrain tiles; the header uses the NPS figures.</caption>
            <thead>
              <tr><th scope="col">Stop</th><th scope="col">Name</th><th scope="col">Up</th>{roundTrip && <th scope="col">Back</th>}<th scope="col">From trailhead ({distUnit(units)})</th><th scope="col">Elevation ({elevUnit(units)})</th></tr>
            </thead>
            <tbody>
              {profile.checkpoints.map((cp, i) => {
                const upE = tl.find((e) => e.checkpoint.id === cp.id && e.dir === 'up')
                const downE = tl.find((e) => e.checkpoint.id === cp.id && e.dir === 'down')
                if (!upE) return null
                return (
                  <tr key={cp.id} className={hereIdx === i ? 'current' : ''}>
                    <th scope="row"><button type="button" className="linkbtn" aria-pressed={hereIdx === i} onClick={() => go(upE.time - start)}>{checkpointLabel(cp.id)}</button></th>
                    <td>{cp.name}</td>
                    <td className="n">{formatClock(upE.time)}</td>
                    {roundTrip && <td className="n">{downE ? formatClock(downE.time) : <span className="fine">turn back</span>}</td>}
                    <td>{distFromM(upE.walkedM, units).toFixed(2)}</td>
                    <td>{Math.round(elevFromM(upE.elevM, units)).toLocaleString('en-US')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>

      <details className="tr-table">
        <summary>The same start time in every quarter</summary>
        <div className="strip-scroll" tabIndex={0} role="region" aria-label="Quarter comparison table, scrolls sideways on small screens">
          <table className="cptable qtable">
            <caption>Sunrise, sunset and whether you finish before dark for a start at {formatClock(start)}, in each quarter (typical for past years).</caption>
            <thead><tr><th scope="col">Quarter</th><th scope="col">Sunrise</th><th scope="col">Sunset</th><th scope="col">{roundTrip ? 'Summit' : 'End'}</th><th scope="col">Back at</th><th scope="col">Before dark?</th></tr></thead>
            <tbody>
              {QUARTERS.map((Q) => {
                const m = quarterMonths[Q.q - 1][1]
                const v = daylightVerdict(tl, m.sunrise, m.sunset)
                return (
                  <tr key={Q.q} className={Q.q === q ? 'current' : ''}>
                    <th scope="row"><button type="button" className="linkbtn" aria-pressed={Q.q === q} onClick={() => onQuarter(Q.q)}>{Q.label} {Q.months}</button></th>
                    <td>{formatClock(v.sunriseMin)}</td><td>{formatClock(v.sunsetMin)}</td>
                    <td>{formatClock(turn.time)}</td><td>{formatClock(v.finishMin)}</td>
                    <td>{v.finishesAfterSunset
                      ? <span className="trail-warn"><StatusIcon status="warn" size={14} /> No, {durationLabel(-v.marginMin)} after sunset</span>
                      : <span className="trail-ok"><StatusIcon status="ok" size={14} /> Yes, {durationLabel(v.marginMin)} to spare</span>}
                      {v.startsBeforeSunrise && <span className="trail-warn"> · starts before sunrise</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
      <p className="fine">Typical walking times from a standard hiking-speed model (Tobler's hiking function on the elevation profile, scaled to the official trail length, plus 10 minutes at each stop), with past-years sunrise and sunset. Not a forecast; your pace will differ.</p>
    </>
  )
}
