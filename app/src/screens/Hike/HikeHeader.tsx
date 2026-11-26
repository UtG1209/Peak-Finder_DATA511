// Hike page hero (v2, docs/design/hike-page/canvas-v2/Main.dc.html): photo first with its Wikimedia Commons credit; then park and difficulty,
// the name (the page's h1, focused after navigation), the description, the answer sentence, three ruled numbers (best quarter, fit, typical trip),
// the NPS facts with a small route glyph, gear with words, permit and closure notes as hazard chips, "Walk it in 3D" and the NPS link. Look: hero.css.
import { useMemo, type KeyboardEvent, type Ref } from 'react'
import { line, scaleLinear } from 'd3'
import type { Hike, Quarter } from '../../data/schema'
import { GearList } from '../../components/GearList'
import { Icon } from '../../components/Icon'
import { DIFFICULTY_LABEL } from '../../lib/difficulty'
import { usd } from '../../lib/money'
import { QUARTERS } from '../../lib/quarters'
import { durationLabel, trailCurve } from '../../lib/trail'
import { fmtElev, fmtLength, type Units } from '../../lib/units'
import { finishTime, timeline } from '../../models/checkpoints'
import { useProfile } from './useProfile'
import './hero.css'

interface Props {
  hike: Hike
  /** The answer sentence (models/headline.ts): the first thing under the name. */
  headline: string
  units: Units
  /** The 3D walk link for the chosen quarter's season, or null when the hike has no walk. Lane 2 wraps it in the cloud transition. */
  walkHref: string | null
  seasonLabel: string
  onWalkStart?: () => void
  /** The h1: Hike.tsx moves focus here when the page opens. */
  titleRef?: Ref<HTMLHeadingElement>
  /** Best quarter (tie-broken by cost). The stat tiles show only when it is given. */
  best?: Quarter
  /** Its rounded match, or null when no limit is set: the tile then reads "No limits set". */
  bestMatch?: number | null
  /** The line under the match, e.g. "Q1 and Q2 also 100%". */
  tieNote?: string | null
  /** Typical trip for the best quarter, or null with no home city. */
  trip?: { total: number; note: string } | null
}

const GLYPH_W = 160
const GLYPH_H = 48

/** Sources sit in `title` (mouse) and show as a card on keyboard focus; Esc leaves it (design v2: a source is one hover or one focus away). */
const escBlur = (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Escape') e.currentTarget.blur() }

export function HikeHeader({ hike, headline, units, walkHref, seasonLabel, titleRef, onWalkStart, best, bestMatch = null, tieNote = null, trip = null }: Props) {
  const p = hike.photo
  const profile = useProfile(hike.id)
  const roundTrip = hike.route_type === 'out-and-back'
  const route = useMemo(() => {
    if (!profile || profile.points.length < 2) return null
    const pts = trailCurve(profile, roundTrip)
    const x = scaleLinear().domain([0, pts[pts.length - 1].walkedM]).range([2, GLYPH_W - 2])
    const ys = pts.map((d) => d.elevM)
    const y = scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range([GLYPH_H - 4, 4])
    const d = line<(typeof pts)[number]>().x((d) => x(d.walkedM)).y((d) => y(d.elevM))(pts)
    const minutes = profile.checkpoints.length >= 2 ? finishTime(timeline(profile, 0, roundTrip)) : null
    return { d, minutes }
  }, [profile, roundTrip])
  const bq = best ? QUARTERS[best - 1] : null
  const lengthWord = hike.length_type === 'one-way' ? 'One way' : hike.length_type === 'loop' ? 'Loop' : 'Round trip'

  return (
    <header className="hp-head hero">
      <figure className="hp-photo">
        <img src={`${import.meta.env.BASE_URL}${p.file}`} alt={`${hike.name}, ${hike.park_name}`} />
        <figcaption>
          Photo: {p.author} · {p.license_url ? <a href={p.license_url} target="_blank" rel="noreferrer">{p.license}</a> : p.license}
          {p.page && <> · <a href={p.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></>}
        </figcaption>
      </figure>
      <div className="hp-intro">
        <div className="hero-title">
          <p className="eyebrow">
            <span>{hike.park_name}, {hike.state}</span>
            <span className="hero-diff"><Icon name="peak" size={14} className={`peak-${hike.difficulty}`} />{DIFFICULTY_LABEL[hike.difficulty]}</span>
          </p>
          <h1 ref={titleRef} tabIndex={-1}>{hike.name}</h1>
          <p className="desc">{hike.description}</p>
        </div>
        <p className="headline" aria-live="polite">{headline}</p>

        {bq && (
          <dl className="hero-stats">
            <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="The quarter with the highest match to your limits; a tie goes to the cheaper quarter">
              <dt>Best quarter</dt>
              <dd className={bestMatch == null && !trip ? 'num num-word' : 'num'}>{bestMatch == null && !trip ? 'Any quarter' : bq.label}</dd>
              <dd className="cap">{bestMatch == null && !trip ? 'No limits set, no home city' : `${bq.months}, ${bq.season}`}</dd>
            </div>
            <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="Match % of the best quarter: typical values from past years against your limits">
              <dt>Fits your limits</dt>
              <dd className={bestMatch == null || bestMatch >= 100 ? 'num num-word' : 'num'}>{bestMatch == null ? 'No limits set' : bestMatch >= 100 ? 'All met' : `${bestMatch}%`}</dd>
              {tieNote && <dd className="cap">{tieNote}</dd>}
            </div>
            <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="Typical trip cost for the best quarter, from past data (DOT fares, GSA lodging and meals, EIA gas, NPS fees). Not a price quote.">
              <dt>Typical trip</dt>
              <dd className={trip ? 'num' : 'num num-word'}>{trip ? usd(trip.total) : 'No home city'}</dd>
              <dd className="cap">{trip ? trip.note : 'Pick one on the map to see costs'}</dd>
            </div>
          </dl>
        )}

        <div className="hero-facts">
          <dl className="facts">
            <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="Length from the National Park Service page, not the length measured from the map">
              <dt>{lengthWord}, NPS</dt><dd className="num">{fmtLength(hike.length_mi, units)}</dd>
            </div>
            <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="Total climbing, from the National Park Service"><dt>Gain, NPS</dt><dd className="num">{fmtElev(hike.gain_ft, units)}</dd></div>
            <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="Highest point of the route, from the National Park Service"><dt>Summit elevation, NPS</dt><dd className="num">{fmtElev(hike.max_elev_ft, units)}</dd></div>
            {route?.minutes != null && (
              <div className="srcfocus" tabIndex={0} onKeyDown={escBlur} title="Typical moving time at an average pace (Tobler's hiking function), scaled to the NPS length, with 10 minutes at each stop">
                <dt>Typical pace, stops incl.</dt><dd className="num">{durationLabel(route.minutes)}</dd>
              </div>
            )}
          </dl>
          {route?.d && (
            <svg className="hero-route" viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`} width={GLYPH_W} height={GLYPH_H} role="img"
              aria-label={`Route shape: elevation along the trail${roundTrip ? ', there and back the same way' : ''}`}>
              <path d={route.d} />
            </svg>
          )}
        </div>

        <GearList gear={hike.gear} />
        {(hike.permit_note || hike.closure_note) && (
          <div className="hero-notes">
            {hike.permit_note && <p className="hz"><Icon name="alert" size={18} /><span><b>Permit.</b> {hike.permit_note}</span></p>}
            {hike.closure_note && <p className="hz"><Icon name="alert" size={18} /><span><b>Closure.</b> {hike.closure_note}</span></p>}
          </div>
        )}
        <div className="hp-actions">
          {walkHref && (
            <a className="go" href={walkHref} onClick={onWalkStart ? (event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onWalkStart()
            } : undefined}>
              <Icon name="walk3d" />Walk it in 3D<span className="sr-only"> ({seasonLabel} view)</span>
            </a>
          )}
          <a className="hero-btn" href={hike.nps_url} target="_blank" rel="noreferrer">NPS trail page</a>
        </div>
        <p className="cap">Typical, from past years (2015 to 2024, 2020 left out). Hover any number for its source.</p>
      </div>
    </header>
  )
}
