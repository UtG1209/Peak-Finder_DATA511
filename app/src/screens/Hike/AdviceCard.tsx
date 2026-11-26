// "Advice vs data" (v2 evidence style): a piece of common travel advice, quoted, then what official data says, a bar chart of the numbers
// when they are comparable (lib/adviceBars.ts), and the source. Previous / Next step through every card this hike has. Look: adviceCard.css.
import { useState } from 'react'
import { scaleLinear } from 'd3'
import type { Advice } from '../../data/schema'
import { useData } from '../../data/DataContext'
import { Icon } from '../../components/Icon'
import { comparableBars, fmtAdviceNumber } from '../../lib/adviceBars'
import './adviceCard.css'

const W = 440
const ROW = 40

export function AdviceCard({ advice }: { advice: Advice }) {
  const { data } = useData()
  const all = data.advice.filter((a) => a.hike_id === advice.hike_id)
  const cards = all.length ? all : [advice]
  const [pick, setPick] = useState<{ hike: string; i: number }>({ hike: advice.hike_id, i: Math.max(0, cards.indexOf(advice)) })
  const i = pick.hike === advice.hike_id ? Math.min(pick.i, cards.length - 1) : Math.max(0, cards.indexOf(advice))
  const a = cards[i]
  const go = (d: 1 | -1) => setPick({ hike: advice.hike_id, i: (i + d + cards.length) % cards.length })

  const bars = comparableBars(a.numbers)
  const max = bars ? Math.max(...bars.map(([, v]) => v)) : 0
  const x = scaleLinear().domain([0, max || 1]).range([0, W - 96])
  const h = bars ? bars.length * ROW + 20 : 0
  const spoken = bars?.map(([k, v]) => `${k} ${fmtAdviceNumber(v)}`).join(', ')

  return (
    <section className="advice adv" aria-labelledby="advice-h">
      <div className="adv-text">
        <h2 id="advice-h" className="adv-eyebrow">Advice vs data{cards.length > 1 && `, ${i + 1} of ${cards.length}`}</h2>
        <p className="adv-claim">“{a.claim}”</p>
        <p className="adv-finding" aria-live="polite"><b>What the data says.</b> {a.finding}</p>
        <div className="adv-row">
          {cards.length > 1 && (
            <>
              <button type="button" className="adv-ico" aria-label="Previous card" onClick={() => go(-1)}><Icon name="arrow-left" /></button>
              <button type="button" className="adv-ico" aria-label="Next card" onClick={() => go(1)}><Icon name="arrow-right" /></button>
            </>
          )}
          <a className="adv-src" href={a.url} target="_blank" rel="noreferrer">Source: {a.source}</a>
        </div>
      </div>
      {bars && (
        <div className="adv-chart">
          <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label={`The numbers behind it, from past years: ${spoken}.`}>
            <text x={0} y={12} className="adv-cap">The numbers behind it, past years</text>
            {bars.map(([k, v], n) => {
              const y = 20 + n * ROW
              return (
                <g key={k}>
                  <text x={0} y={y + 12} className="adv-lab">{k}</text>
                  <rect x={0} y={y + 18} width={Math.max(2, x(v))} height={16} rx={2} className={v === max ? 'adv-bar top' : 'adv-bar'} />
                  <text x={x(v) + 8} y={y + 31} className="adv-val">{fmtAdviceNumber(v)}</text>
                </g>
              )
            })}
          </svg>
          <div className="sr-only"><table>
            <caption>The numbers behind “{a.claim}”, from {a.source}</caption>
            <tbody>{bars.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{fmtAdviceNumber(v)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </section>
  )
}
