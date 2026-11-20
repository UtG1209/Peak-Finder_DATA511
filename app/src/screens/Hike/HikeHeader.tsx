// Hike page header (CLAUDE.md section 2): name, park, description, NPS length and summit elevation, difficulty,
// gear icons, photo with its Wikimedia Commons credit, "Walk it in 3D" (featured hikes only).
import type { Hike } from '../../data/schema'
import { GearList } from '../../components/GearList'
import { DIFFICULTY_COLORS, DIFFICULTY_LABEL } from '../../lib/difficulty'
import { fmtElev, fmtLength, type Units } from '../../lib/units'

interface Props {
  hike: Hike
  units: Units
  /** The 3D walk link for the chosen quarter's season, or null when the hike has no walk. Lane 2 wraps it in the cloud transition. */
  walkHref: string | null
  seasonLabel: string
}

export function HikeHeader({ hike, units, walkHref, seasonLabel }: Props) {
  const p = hike.photo
  return (
    <header className="hp-head">
      <figure className="hp-photo">
        <img src={`${import.meta.env.BASE_URL}${hike.photo.file}`} alt={`${hike.name} (placeholder image)`} />
        <figcaption>
          Photo: {p.author} ·{' '}
          <a href={p.license_url} target="_blank" rel="noreferrer">{p.license}</a> ·{' '}
          <a href={p.page} target="_blank" rel="noreferrer">Wikimedia Commons</a>
        </figcaption>
      </figure>
      <div>
        <div className="diff-tag big"><i style={{ background: DIFFICULTY_COLORS[hike.difficulty] }} /> {DIFFICULTY_LABEL[hike.difficulty]}{hike.featured ? ' · 3D walk ready' : ''}</div>
        <h1>{hike.name}</h1>
        <p className="sub">{hike.park_name}, {hike.state}</p>
        <p className="desc">{hike.description}</p>
        <dl className="facts">
          <div title="Length from the National Park Service page, not the length measured from the map">
            <dt>{hike.length_type === 'one-way' ? 'One way (NPS)' : hike.length_type === 'loop' ? 'Loop (NPS)' : 'Round trip (NPS)'}</dt>
            <dd>{fmtLength(hike.length_mi, units)}</dd>
          </div>
          <div title="Total climbing, from the National Park Service"><dt>Elevation gain</dt><dd>{fmtElev(hike.gain_ft, units)}</dd></div>
          <div title="Highest point of the route, from the National Park Service"><dt>Summit elevation</dt><dd>{fmtElev(hike.max_elev_ft, units)}</dd></div>
        </dl>
        <GearList gear={hike.gear} />
        {hike.permit_note && <p className="note-line">Permit: {hike.permit_note}</p>}
        {hike.closure_note && <p className="note-line warn"><span aria-hidden="true">⚠ </span>Closure: {hike.closure_note}</p>}
        <p className="fine"><a href={hike.nps_url} target="_blank" rel="noreferrer">National Park Service page for this hike</a></p>
        <div className="hp-actions">
          {walkHref && <a className="go" href={walkHref}>Walk it in 3D <span aria-hidden="true">→</span><span className="sr-only"> ({seasonLabel} view)</span></a>}
        </div>
      </div>
    </header>
  )
}
