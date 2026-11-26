// "Your selection" (v2): the sticky bar under the hero. Quarter (URL `q`), month and checkpoint (the linked selection every chart reads),
// and the trip assumptions in words. One tab stop per group; Left and Right step inside the quarter group. Look: selectionBar.css.
import { useMemo, useRef, type KeyboardEvent } from 'react'
import type { Hike, HikeMonth, Quarter } from '../../data/schema'
import { Icon } from '../../components/Icon'
import { cityByCode } from '../../lib/cities'
import { MONTH_NAMES, QUARTERS } from '../../lib/quarters'
import { stepMonth } from '../../lib/stepMonth'
import { checkpointLabel } from '../../lib/trail'
import { useFilters } from '../../lib/useFilters'
import { defaultStartMin, formatClock, timeline } from '../../models/checkpoints'
import type { TravelMode } from '../../models/cost'
import { useSelection } from './selectionContext'
import { useProfile } from './useProfile'
import './selectionBar.css'

interface Props {
  hike: Hike
  /** The three months of each quarter, index 0 = Q1 (the middle month's sunrise sets the default start time). */
  quarterMonths: HikeMonth[][]
  travellers?: number
  nights?: number
  mode?: TravelMode
}

export function SelectionBar({ hike, quarterMonths, travellers, nights, mode }: Props) {
  const [filters, update] = useFilters()
  const { month, setMonth, checkpoint } = useSelection()
  const profile = useProfile(hike.id)
  const qInfo = QUARTERS[filters.q - 1]
  const segRef = useRef<HTMLDivElement>(null)

  const mid = quarterMonths[filters.q - 1]?.[1]
  const cp = useMemo(() => {
    if (checkpoint == null || !profile || profile.checkpoints.length < 2 || !mid) return null
    const c = profile.checkpoints[checkpoint]
    if (!c) return null
    const tl = timeline(profile, defaultStartMin(mid.sunrise), hike.route_type === 'out-and-back')
    const up = tl.find((e) => e.checkpoint.id === c.id && e.dir === 'up') ?? tl.find((e) => e.checkpoint.id === c.id)
    return { label: `${checkpointLabel(c.id)} ${c.name}`, time: up ? formatClock(up.time) : null }
  }, [checkpoint, profile, mid, hike.route_type])

  const onSegKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const q = (((filters.q - 1 + (e.key === 'ArrowRight' ? 1 : 3)) % 4) + 1) as Quarter
    update({ q })
    requestAnimationFrame(() => segRef.current?.querySelector<HTMLButtonElement>(`[data-q="${q}"]`)?.focus())
  }

  const city = cityByCode(filters.from)?.name
  const trip = [
    city ? `From ${city}` : 'No home city',
    travellers != null ? `${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}` : null,
    nights != null ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : null,
    city && mode ? mode : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="selbar" role="region" aria-label="Your selection">
      <b className="selbar-title">Your selection</b>
      <div className="selbar-grp">
        <span className="selbar-lab" id="selbar-q">Quarter</span>
        <div className="selbar-seg" role="group" aria-labelledby="selbar-q" ref={segRef} onKeyDown={onSegKey}>
          {QUARTERS.map(({ q, label, months }) => (
            <button key={q} type="button" data-q={q} aria-pressed={filters.q === q} tabIndex={filters.q === q ? 0 : -1}
              aria-label={`${label}, ${months}`} onClick={() => update({ q })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="selbar-grp">
        <span className="selbar-lab">Month</span>
        <button type="button" className="selbar-ico" aria-label="Previous month" onClick={() => setMonth(stepMonth(qInfo.monthNumbers, month, -1))}><Icon name="arrow-left" /></button>
        <output className="selbar-month" aria-live="polite">{month ? MONTH_NAMES[month - 1] : `Whole ${qInfo.label}`}</output>
        <button type="button" className="selbar-ico" aria-label="Next month" onClick={() => setMonth(stepMonth(qInfo.monthNumbers, month, 1))}><Icon name="arrow-right" /></button>
      </div>
      {cp && (
        <div className="selbar-grp">
          <span className="selbar-lab">Checkpoint</span>
          <button type="button" className="selbar-pill" title="Clock time going up, at the default start (1 hour after sunrise)"
            onClick={() => document.getElementById('trail-h')?.scrollIntoView({ block: 'start' })}>
            {cp.label}{cp.time && `, ${cp.time}`}
          </button>
        </div>
      )}
      <span className="selbar-note">{trip}. Every chart follows this.</span>
    </div>
  )
}
