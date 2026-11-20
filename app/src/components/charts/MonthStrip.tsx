// "Month by month": 12 columns, one row each for typical high, crowds, smoky days, wet days and daylight, plus a hazard row.
// A real table (row and column headers) so screen readers get it for free. Cells past the user's limits carry an icon and words;
// the chosen quarter's three months are framed; missing data is a grey cell that says why.
import { StatusIcon } from '../StatusIcon'
import type { Cell, Column, Hazard } from '../../lib/monthStrip'

interface RowDef {
  key: 'temp' | 'crowd' | 'smoky' | 'wet' | 'daylight'
  label: string
  /** What the number means, for hover (and spelled out under the table). */
  hint: string
}

const ROWS: RowDef[] = [
  { key: 'temp', label: 'Typical high', hint: 'Median daytime high of the month, 2015 to 2024 without 2020' },
  { key: 'crowd', label: 'Crowds', hint: 'Park visits that month as a share of the park\'s busiest month (the park, not this trail)' },
  { key: 'smoky', label: 'Smoky days', hint: 'Days a year with air quality above 100 where fine smoke particles were the cause (county level)' },
  { key: 'wet', label: 'Wet days', hint: 'Days with at least 0.1 inch (2.5 mm) of rain or melted snow' },
  { key: 'daylight', label: 'Daylight', hint: 'Hours between sunrise and sunset, computed from the trailhead position and the date' },
]

const HAZARD_ICON: Record<Hazard['key'], string> = { heat: '☀', smoke: '≋', snow: '❄', closed: '⛔' }

function CellView({ cell }: { cell: Cell }) {
  return (
    <>
      {cell.state === 'past' && <StatusIcon status="warn" size={14} />}
      <span className="cv-text">{cell.text}</span>
      {cell.state === 'past' && <span className="cv-note">Past limit</span>}
      {cell.note && <span className="sr-only">{`. ${cell.note}`}</span>}
    </>
  )
}

export function MonthStrip({ columns, chosenLabel }: { columns: Column[]; chosenLabel: string }) {
  const anyMissing = columns.some((c) => c.temp.state === 'missing' || c.wet.state === 'missing')
  const frame = (c: Column) => `${c.inChosenQuarter ? ' inq' : ''}${c.inChosenQuarter && c.firstOfQuarter ? ' qfirst' : ''}${c.inChosenQuarter && c.lastOfQuarter ? ' qlast' : ''}`
  return (
    <div className="strip-wrap">
      <div className="strip-scroll" tabIndex={0} role="region" aria-label="Month by month table, scrolls sideways on small screens">
        <table className="strip">
          <caption className="sr-only">Typical conditions for each month. The three months of {chosenLabel} are framed.</caption>
          <thead>
            <tr>
              <td />
              {columns.map((c) => (
                <th key={c.month} scope="col" className={`mh${frame(c)}${c.inChosenQuarter ? ' chosen' : ''}`}>
                  {c.name}
                  {c.inChosenQuarter && c.month === columns.find((x) => x.inChosenQuarter)?.month && <small className="qtag">{chosenLabel}</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key}>
                <th scope="row" title={r.hint}>{r.label}</th>
                {columns.map((c) => {
                  const cell = c[r.key]
                  return (
                    <td key={c.month} className={`sc ${cell.state}${frame(c)}`} title={cell.note || undefined}>
                      <CellView cell={cell} />
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="hazard-row">
              <th scope="row" title="Heat (days of 100°F or more), smoke, snow and closures, when there are any">Hazards</th>
              {columns.map((c) => (
                <td key={c.month} className={`sc hz${frame(c)}`}>
                  {c.hazards.length === 0 ? <span className="cv-none">None</span> : (
                    <ul>
                      {c.hazards.map((h) => (
                        <li key={h.key}><StatusIcon status="warn" size={13} /><span><span aria-hidden="true">{HAZARD_ICON[h.key]} </span>{h.text}</span></li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="strip-notes fine">
        <li>Typical values from past years (2015 to 2024, without 2020), not a forecast. Hover a row name for what it measures.</li>
        <li>A cell says "Past limit" when it is outside what you set. Day limits are for a whole quarter, so a month is marked when it alone is above a third of your limit.</li>
        <li>Crowds are for the whole park; smoky days are for the county; temperature and rain come from the nearest weather station. Heat means days of 100°F or more.</li>
        {anyMissing && <li><span className="cv-text">—</span> in grey: No station within 50 km. Temperature and rain are left out of the match for this hike.</li>}
      </ul>
    </div>
  )
}
