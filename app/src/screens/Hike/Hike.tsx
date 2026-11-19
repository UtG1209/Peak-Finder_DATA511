// PLACEHOLDER. Lane 4 (docs/work/lane-4-hike-page.md) builds the hike page.
import { Link, useLocation, useParams } from 'react-router-dom'
import { useData } from '../../data/DataContext'

export default function Hike() {
  const { id } = useParams()
  const { search } = useLocation()
  const { index } = useData()
  const hike = id ? index.hikeById.get(id) : undefined
  return (
    <main className="page">
      <Link to={{ pathname: '/', search }}>← Back to map</Link>
      {hike ? (
        <>
          <h1>{hike.name}</h1>
          <p>{hike.park_name}, {hike.state}</p>
          <p>{hike.description}</p>
          <p className="fine">Hike page placeholder. Lane 4 builds quarter fit, month strip, timed profile and cost bars here.</p>
        </>
      ) : (
        <p>We could not find that hike.</p>
      )}
    </main>
  )
}
