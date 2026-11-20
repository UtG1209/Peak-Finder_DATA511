// Hike page header (CLAUDE.md section 2): photo first with its Wikimedia Commons credit, then park, name (the page's h1, focused after navigation),
// description, a ruled facts row (NPS length, gain, summit elevation, difficulty), gear with words, permit and closure notes,
// and "Walk it in 3D" for featured hikes. Look and tokens: styles/hike.css.
import type { Ref } from 'react'
import type { Hike } from '../../data/schema'
import { GearList } from '../../components/GearList'
import { Icon } from '../../components/Icon'
import { DIFFICULTY_LABEL } from '../../lib/difficulty'
import { fmtElev, fmtLength, type Units } from '../../lib/units'

interface Props {
  hike: Hike
  units: Units
  /** The 3D walk link for the chosen quarter's season, or null when the hike has no walk. Lane 2 wraps it in the cloud transition. */
  walkHref: string | null
  seasonLabel: string
  /** The h1: Hike.tsx moves focus here when the page opens. */
  titleRef?: Ref<HTMLHeadingElement>
}

export function HikeHeader({ hike, units, walkHref, seasonLabel, titleRef }: Props) {
  const p = hike.photo
  return (
    <header className="hp-head">
      <figure className="hp-photo">
        <img src={`${import.meta.env.BASE_URL}${p.file}`} alt={`${hike.name}, ${hike.park_name}`} />
        <figcaption>
          Photo: {p.author} · {p.license_url ? <a href={p.license_url} target="_blank" rel="noreferrer">{p.license}</a> : p.license}
          {p.page && <> · <a href={p.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></>}
        </figcaption>
      </figure>
      <div className="hp-intro">
        <p className="eyebrow">{hike.park_name}, {hike.state}</p>
        <h1 ref={titleRef} tabIndex={-1}>{hike.name}</h1>
        <p className="desc">{hike.description}</p>
        <dl className="facts">
          <div title="Length from the National Park Service page, not the length measured from the map">
            <dt>{hike.length_type === 'one-way' ? 'One way (NPS)' : hike.length_type === 'loop' ? 'Loop (NPS)' : 'Round trip (NPS)'}</dt>
            <dd>{fmtLength(hike.length_mi, units)}</dd>
          </div>
          <div title="Total climbing, from the National Park Service"><dt>Elevation gain</dt><dd>{fmtElev(hike.gain_ft, units)}</dd></div>
          <div title="Highest point of the route, from the National Park Service"><dt>Summit elevation</dt><dd>{fmtElev(hike.max_elev_ft, units)}</dd></div>
          <div><dt>Difficulty</dt><dd className="diffval"><Icon name="peak" size={18} className={`peak-${hike.difficulty}`} />{DIFFICULTY_LABEL[hike.difficulty]}</dd></div>
        </dl>
        <GearList gear={hike.gear} />
        {hike.permit_note && <p className="note-line"><b>Permit.</b> {hike.permit_note}</p>}
        {hike.closure_note && <p className="note-line warn"><Icon name="alert" size={16} /><span><b>Closure.</b> {hike.closure_note}</span></p>}
        <p className="fine"><a href={hike.nps_url} target="_blank" rel="noreferrer">National Park Service page for this hike</a></p>
        {walkHref && (
          <div className="hp-actions">
            <a className="go" href={walkHref}><Icon name="walk3d" />Walk it in 3D<Icon name="arrow-right" /><span className="sr-only"> ({seasonLabel} view)</span></a>
          </div>
        )}
      </div>
    </header>
  )
}
