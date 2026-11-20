// "Advice vs data": a piece of common travel advice checked against official data. Shown when the hike has one.
import type { Advice } from '../../data/schema'

export function AdviceCard({ advice }: { advice: Advice }) {
  const entries = Object.entries(advice.numbers).sort(([a], [b]) => a.localeCompare(b))
  const max = Math.max(...entries.map(([, v]) => v), 0.0001)
  return (
    <aside className="advice" aria-labelledby="advice-h">
      <h3 id="advice-h">Advice vs data</h3>
      <p className="claim"><span className="fine">The advice</span><br />“{advice.claim}”</p>
      <p className="finding"><span className="fine">What the data says</span><br />{advice.finding}</p>
      {entries.length > 1 && (
        <ul className="advice-bars" aria-label="The numbers behind it">
          {entries.map(([k, v]) => (
            <li key={k}><span>{k}</span><i style={{ width: `${(v / max) * 100}%` }} /><b>{v <= 1 ? `${Math.round(v * 1000) / 10}%` : v.toLocaleString('en-US')}</b></li>
          ))}
        </ul>
      )}
      <p className="fine">Source: <a href={advice.url} target="_blank" rel="noreferrer">{advice.source}</a></p>
    </aside>
  )
}
