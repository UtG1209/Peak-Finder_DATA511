// "Similar hikes": three twin cards (models/twins.ts), photo first, one line on why each is similar, each linking to that hike's page.
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import type { Hike } from '../../data/schema'
import { DIFFICULTY_LABEL } from '../../lib/difficulty'
import { fmtElev, fmtLength } from '../../lib/units'
import { useFilters } from '../../lib/useFilters'
import { findTwins, type Twin, type TwinFactor } from '../../models/twins'

const PHRASE: Record<TwinFactor, (a: Hike, b: Hike, u: 'us' | 'metric') => string> = {
  length: (a, b, u) => `similar length (${fmtLength(b.length_mi, u)} and ${fmtLength(a.length_mi, u)})`,
  gain: (a, b, u) => `similar climb (${fmtElev(b.gain_ft, u)} and ${fmtElev(a.gain_ft, u)})`,
  top: (a, b, u) => `similar high point (${fmtElev(b.max_elev_ft, u)} and ${fmtElev(a.max_elev_ft, u)})`,
  climate: () => 'a similar pattern of typical temperatures through the year',
}
const whyLine = (a: Hike, b: Hike, t: Twin, u: 'us' | 'metric') => `${PHRASE[t.why[0]](a, b, u)} and ${PHRASE[t.why[1]](a, b, u)}.`.replace(/^./, (c) => c.toUpperCase())

export function SimilarHikes({ hike }: { hike: Hike }) {
  const { data, index } = useData()
  const [filters] = useFilters()
  const { search } = useLocation()
  const twins = useMemo(() => findTwins(hike.id, data.hikes, index.months), [hike.id, data.hikes, index.months])
  const noMonths = !index.months.get(hike.id)?.some((m) => m.tmax_p50 != null)

  return (
    <section aria-labelledby="similar-h" className="similarsec">
      <h2 id="similar-h">Similar hikes</h2>
      {twins.length === 0 ? (
        <p className="fine">No similar hikes to show yet.</p>
      ) : (
        <>
          <ul className="twins">
            {twins.map((t) => {
              const other = index.hikeById.get(t.id)!
              return (
                <li key={t.id}>
                  <Link to={{ pathname: `/hike/${t.id}`, search }} className="twin" onClick={() => window.scrollTo(0, 0)}>
                    <img src={`${import.meta.env.BASE_URL}${other.photo.file}`} alt="" loading="lazy" />
                    <span className="twin-body">
                      <b className="twin-name">{other.name}</b>
                      <span className="twin-sub">{other.park_name} · {DIFFICULTY_LABEL[other.difficulty]}{other.park_code !== hike.park_code ? '' : ' · same park'}</span>
                      <span className="twin-why">{whyLine(hike, other, t, filters.units)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="fine">Matched on length, climb, high point and typical highs in each month{noMonths ? '. This hike has no monthly temperatures, so temperature was left out for it' : ''}. Typical, from past years.</p>
        </>
      )}
    </section>
  )
}
