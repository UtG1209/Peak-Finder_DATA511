// "On the trail": the elevation profile with time (CLAUDE.md section 2). Start time, checkpoint clock times going up and coming
// back, a time scrubber with a hiker marker, Back / Forward between checkpoints (buttons and arrow keys), and a daylight band.
// All timing comes from models/checkpoints.ts (Tobler's hiking function); this file is state and layout.
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { loadProfile } from '../../data/loaders'
import type { Hike, HikeMonth, Profile, Quarter } from '../../data/schema'
import { DaylightBand } from '../../components/charts/DaylightBand'
import { ElevationProfile } from '../../components/charts/ElevationProfile'
import { Icon } from '../../components/Icon'
import { StatusIcon } from '../../components/StatusIcon'
import { QUARTERS } from '../../lib/quarters'
import { checkpointLabel, daylightVerdict, durationLabel, trailCurve, turnaroundEvent } from '../../lib/trail'
import { distFromM, distUnit, elevFromM, elevUnit, fmtDist, fmtElev, type Units } from '../../lib/units'
import { defaultStartMin, eventIndexAt, finishTime, formatClock, parseClock, positionAt, stepTime, timeAtWalked, timeline } from '../../models/checkpoints'

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
    <section aria-labelledby="trail-h" className="trailsec">
      <h2 id="trail-h">On the trail</h2>
      {!ready && <div className="skeleton-block" aria-busy="true" role="status"><span className="sr-only">Loading the elevation profile…</span></div>}
      {ready?.error && (
        <p className="empty-cost" role="alert">
          We could not load the elevation profile. {ready.error} <button type="button" className="linkbtn" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
        </p>
      )}
      {ready?.profile && <Trail key={hike.id} hike={hike} profile={ready.profile} quarterMonths={quarterMonths} q={q} units={units} onQuarter={onQuarter} />}
    </section>
  )
}

function Trail({ hike, profile, quarterMonths, q, units, onQuarter }: Props & { profile: Profile }) {
  const roundTrip = hike.route_type === 'out-and-back'
  const mid = quarterMonths[q - 1][1] // the quarter's middle month: its sunrise and sunset stand for the quarter
  const defaultStart = defaultStartMin(mid.sunrise)

  const [startOverride, setStartOverride] = useState<number | null>(null)
  const start = startOverride ?? defaultStart
  const [elapsed, setElapsed] = useState(0) // minutes since the start: stays put when the start time or quarter changes
  const [photoFailed, setPhotoFailed] = useState<string | null>(null)

  const hasCheckpoints = profile.checkpoints.length >= 2 && profile.points.length >= 2
  const tl = useMemo(() => (hasCheckpoints ? timeline(profile, start, roundTrip) : null), [profile, start, roundTrip, hasCheckpoints])
  const curve = useMemo(() => trailCurve(profile, roundTrip), [profile, roundTrip])
  if (!tl) return <p className="empty-cost">This hike has no checkpoints yet, so there is no timed profile.</p>

  const duration = finishTime(tl) - start
  const el = clamp(elapsed, 0, duration)
  const t = start + el
  const pos = positionAt(tl, t)
  const verdict = daylightVerdict(tl, mid.sunrise, mid.sunset)
  const turn = turnaroundEvent(tl)
  const idx = eventIndexAt(tl, t)
  const here = idx >= 0 ? tl[idx] : tl[0]
  const atStop = t <= here.time + here.stopMin && here.stopMin > 0
  const sel = QUARTERS[q - 1]
  const step = (dir: 1 | -1) => setElapsed(stepTime(tl, t, dir) - start)
  const finished = t >= finishTime(tl) - 1e-6
  const where = finished ? 'Finished' : pos.dir === 'down' ? 'Coming back' : t <= tl[0].time ? 'At the start' : 'Going up'

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setElapsed(0) }
    else if (e.key === 'End') { e.preventDefault(); setElapsed(duration) }
  }

  const margin = durationLabel(verdict.marginMin)
  const summitWord = roundTrip ? 'the summit' : 'the end of the route'

  return (
    <>
      <div className="trail-controls">
        <label className="starttime">Start time
          <input type="time" step={300} value={toInput(start)} onChange={(e) => e.target.value && setStartOverride(parseClock(e.target.value))} />
        </label>
        {startOverride !== null && <button type="button" className="linkbtn" onClick={() => setStartOverride(null)}>Use sunrise + 1 h ({formatClock(defaultStart)})</button>}
        <span className="fine">Default: 1 hour after sunrise in {sel.label}'s middle month.</span>
      </div>

      <div className="trail-verdict" aria-live="polite">
        <p className="verdict">
          Start <b>{formatClock(start)}</b>. Reach {summitWord} at about <b>{formatClock(turn.time)}</b>{roundTrip ? <>, and be back at the trailhead at about <b>{formatClock(verdict.finishMin)}</b></> : null} ({durationLabel(duration)} including stops).
        </p>
        {verdict.finishesAfterSunset
          ? <p className="verdict trail-warn"><StatusIcon status="warn" size={18} /> <span><b>After dark:</b> sunset in {sel.label} is about {formatClock(verdict.sunsetMin)}, so you would finish {durationLabel(-verdict.marginMin)} after sunset. Start earlier, turn around sooner, or carry a headlamp.</span></p>
          : <p className="verdict trail-ok"><StatusIcon status="ok" size={18} /> <span><b>Before dark:</b> sunset in {sel.label} is about {formatClock(verdict.sunsetMin)}, about {margin} after you finish.</span></p>}
        {verdict.startsBeforeSunrise && <p className="verdict trail-warn"><StatusIcon status="warn" size={18} /> <span><b>Starts before sunrise</b> ({formatClock(verdict.sunriseMin)}): you would be walking in the dark at first.</span></p>}
      </div>

      <div className="trailgrid">
        <div>
          <div
            className="chartbox" role="group" tabIndex={0} onKeyDown={onKey}
            aria-label="Elevation profile. Use the left and right arrow keys to step between checkpoints, Home for the start and End for the finish."
          >
            <ElevationProfile curve={curve} events={tl} pos={pos} units={units} hikeName={hike.name} onScrub={(w) => setElapsed(timeAtWalked(tl, w) - start)} />
          </div>
          <ul className="chart-legend" aria-hidden="true">
            <li><svg width="34" height="12"><line x1="0" x2="34" y1="6" y2="6" className="lg-up" /><circle cx="17" cy="6" r="4.5" className="lgc-up" /></svg> Going up (filled)</li>
            {roundTrip && <li><svg width="34" height="12"><line x1="0" x2="34" y1="6" y2="6" className="lg-down" /><circle cx="17" cy="6" r="4.5" className="lgc-down" /></svg> Coming back (hollow, dashed)</li>}
            <li>Drag the chart or the slider to move along the trail</li>
          </ul>

          <div className="scrub">
            <button type="button" className="fit" onClick={() => step(-1)} disabled={el <= 0}><Icon name="arrow-left" size={16} />Back</button>
            <label className="scrub-range">
              <span className="sr-only">Time on the trail</span>
              <input
                type="range" min={0} max={Math.ceil(duration)} step={1} value={Math.round(el)}
                onChange={(e) => setElapsed(Number(e.target.value))}
                aria-valuetext={`${formatClock(t)}, ${where.toLowerCase()}, ${fmtDist(pos.walkedM, units)} walked, elevation ${fmtElev(pos.elev / 0.3048, units)}`}
              />
            </label>
            <button type="button" className="fit" onClick={() => step(1)} disabled={el >= duration}>Forward<Icon name="arrow-right" size={16} /></button>
          </div>

          <DaylightBand verdict={verdict} nowMin={t} />
        </div>

        <aside className="readout" aria-live="polite" aria-label="Where you are at this time">
          <div className="ro-time"><b>{formatClock(t)}</b><span>{where}</span></div>
          <dl className="ro-facts">
            <div><dt>Elapsed</dt><dd>{durationLabel(el)}</dd></div>
            <div><dt>Walked</dt><dd>{fmtDist(pos.walkedM, units)}</dd></div>
            <div><dt>Elevation</dt><dd>{fmtElev(pos.elev / 0.3048, units)}</dd></div>
          </dl>
          <div className="ro-stop">
            <h3>{atStop ? 'At' : 'Last stop'}: {checkpointLabel(here.checkpoint.id)} {here.checkpoint.name}</h3>
            {here.checkpoint.photo && photoFailed !== here.checkpoint.photo ? (
              <img src={`${import.meta.env.BASE_URL}${here.checkpoint.photo}`} alt={here.checkpoint.name} loading="lazy" onError={() => setPhotoFailed(here.checkpoint.photo)} />
            ) : (
              <p className="fine">No photo for this stop.</p>
            )}
            {here.checkpoint.photo && photoFailed !== here.checkpoint.photo && <p className="fine">Photo from this hike's 3D walk; its credits are on the walk page.</p>}
          </div>
          <p className="ro-next">{pos.nextCheckpoint ? <>Next: <b>{checkpointLabel(pos.nextCheckpoint.checkpoint.id)} {pos.nextCheckpoint.checkpoint.name}</b> at {formatClock(pos.nextCheckpoint.time)}</> : 'You have finished the route.'}</p>
        </aside>
      </div>

      <h3 className="cp-h">Checkpoints and times</h3>
      <div className="strip-scroll" tabIndex={0} role="region" aria-label="Checkpoint times table, scrolls sideways on small screens">
        <table className="cptable">
          <caption className="sr-only">Clock time at each checkpoint going up{roundTrip ? ' and coming back' : ''}, for a start at {formatClock(start)}.</caption>
          <thead>
            <tr><th scope="col">Stop</th><th scope="col">Going up</th>{roundTrip && <th scope="col">Coming back</th>}<th scope="col">Distance ({distUnit(units)})</th><th scope="col">Elevation ({elevUnit(units)})</th></tr>
          </thead>
          <tbody>
            {profile.checkpoints.map((cp) => {
              const upE = tl.find((e) => e.checkpoint.id === cp.id && e.dir === 'up')
              const downE = tl.find((e) => e.checkpoint.id === cp.id && e.dir === 'down')
              if (!upE) return null
              const current = here.checkpoint.id === cp.id
              return (
                <tr key={cp.id} className={current ? 'current' : ''}>
                  <th scope="row"><button type="button" className="linkbtn" onClick={() => setElapsed(upE.time - start)}>{checkpointLabel(cp.id)} {cp.name}</button></th>
                  <td>{formatClock(upE.time)}</td>
                  {roundTrip && <td>{downE ? formatClock(downE.time) : <span className="fine">turnaround</span>}</td>}
                  <td>{distFromM(upE.walkedM, units).toFixed(1)}</td>
                  <td>{Math.round(elevFromM(upE.elevM, units)).toLocaleString('en-US')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 className="cp-h">The same start time in every quarter</h3>
      <div className="strip-scroll" tabIndex={0} role="region" aria-label="Quarter comparison table, scrolls sideways on small screens">
      <table className="cptable qtable">
        <caption className="sr-only">Sunrise, sunset and whether you finish before dark for a start at {formatClock(start)}, in each quarter.</caption>
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
      <p className="fine">Typical walking times from a standard hiking-speed model (Tobler's hiking function on the elevation profile, scaled to the official trail length, plus 10 minutes at each stop). A fit adult at an ordinary pace, past-years sunrise and sunset. Not a forecast; your pace will differ.</p>
    </>
  )
}
