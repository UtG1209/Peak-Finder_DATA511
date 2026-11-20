// The linked dashboard strip under the 3D scene: updates with the selected (or hovered) hike, the quarter and the filters.
import type { HikeMonth, Quarter } from '../../../data/schema'
import { MonthCrowdSmoke } from './MonthCrowdSmoke'
import { QuarterMatch } from './QuarterMatch'

interface Props {
  hikeName: string
  matches: number[]
  months: HikeMonth[]
  quarter: Quarter
}

export function Dashboard({ hikeName, matches, months, quarter }: Props) {
  return (
    <section className="v3d-dash" aria-label={`Dashboard for ${hikeName}`}>
      <h3>{hikeName}</h3>
      <QuarterMatch hikeName={hikeName} matches={matches} selectedQuarter={quarter} />
      <MonthCrowdSmoke hikeName={hikeName} months={months} selectedQuarter={quarter} />
    </section>
  )
}
