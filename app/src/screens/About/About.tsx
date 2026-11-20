// PLACEHOLDER. Lane 4 builds About: sources with as-of dates, how match % is computed, honest limits.
import { Link } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { Icon } from '../../components/Icon'

export default function About() {
  const { data } = useData()
  return (
    <main className="page">
      <Link to="/" className="back"><Icon name="arrow-left" />Back to map</Link>
      <h1>About the data</h1>
      <ul>
        {data.meta.sources.map((s) => (
          <li key={s.name}><a href={s.url}>{s.name}</a> · as of {s.as_of}</li>
        ))}
      </ul>
      <p className="fine">About page placeholder (lane 4).</p>
    </main>
  )
}
