import type { Hike } from '../data/schema'
import type { ReasonRow } from '../lib/reasons'
import { DIFFICULTY_LABEL } from '../lib/difficulty'
import { Icon, type IconName } from './Icon'

interface Props {
  hike: Hike
  quarterLabel: string
  match: number
  fits: boolean
  rows: ReasonRow[]
  /** e.g. "About $2,077 for 2 people, 3 nights". null when no home city is chosen. */
  costLine: string | null
  onOpen: () => void
  /** True when the user clicked this hike (tile stays open until closed); false while it is only a hover or the default preview. */
  selected?: boolean
  onClose?: () => void
}

const iconFor = (r: ReasonRow): IconName => (r.warn ? 'alert' : r.note === 'No data' || r.note === 'No limit' ? 'dash' : 'check')

/** The preview tile (hover to peek, click a peak to keep it open): photo with name on it, fit line, reasons with icon + words, typical cost, one button. */
export function HikeCard({ hike, quarterLabel, match, fits, rows, costLine, onOpen, selected = false, onClose }: Props) {
  return (
    <aside id="detail" className={selected ? 'selected' : ''} aria-live="polite" aria-label={`${hike.name} summary`}>
      <div className="ph">
        <img src={`${import.meta.env.BASE_URL}${hike.photo.file}`} alt={hike.photo.author.includes('placeholder') ? `${hike.name} (placeholder image)` : `${hike.name}. Photo: ${hike.photo.author}, ${hike.photo.license}`} loading="lazy" />
        {selected && onClose && (
          <button type="button" className="tile-x" aria-label="Close preview" onClick={onClose}><Icon name="close" size={18} /></button>
        )}
        <div className="ph-cap">
          {hike.featured && <span className="ph-tag"><Icon name="walk3d" size={14} /> 3D walk ready</span>}
          <h3>{hike.name}</h3>
          <div className="sub">{hike.park_name}</div>
        </div>
      </div>
      <div className="in">
        <div className="fit-line">
          <span className={`fit-pct${fits ? '' : ' out'}`}>{Math.round(match)}%</span>
          <span className="fit-words">{fits ? `match, fits ${quarterLabel}` : `match, past a limit in ${quarterLabel}`}</span>
        </div>
        <div className="diff-tag"><i className={`d-${hike.difficulty}`} /> {DIFFICULTY_LABEL[hike.difficulty]} · {hike.length_mi} mi {hike.length_type}</div>
        <div className="rows">
          {rows.map((r) => (
            <div key={r.key} className={`row${r.warn ? ' warn' : ''}`}>
              <Icon name={iconFor(r)} size={16} />
              <span className="l">{r.label}</span>
              <span className="v">{r.value}</span>
              <span className="n">{r.note}</span>
            </div>
          ))}
        </div>
        <div className="cost">{costLine ?? 'Pick a home city to see a typical cost.'}</div>
        {!hike.photo.author.includes('placeholder') && <p className="photo-credit">Photo: {hike.photo.author} · {hike.photo.license} · Wikimedia Commons</p>}
        <button type="button" className="go" onClick={onOpen}>
          Open this hike <Icon name="arrow-right" />
        </button>
      </div>
    </aside>
  )
}
