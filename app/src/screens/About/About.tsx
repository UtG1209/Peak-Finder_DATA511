// About the data (CLAUDE.md section 2): sources with links and as-of dates, how match % is computed with a worked example,
// how costs and times are made, and the honest limits. The worked example is computed live by the same model the app uses,
// so the page cannot drift from the numbers on screen.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../data/DataContext'
import { Icon } from '../../components/Icon'
import { quarterMonths } from '../../data/loaders'
import { StatusIcon } from '../../components/StatusIcon'
import { STOP_MINUTES, MAX_SLOPE, SMOOTH_WINDOW_M } from '../../models/checkpoints'
import { computeMatch, NO_LIMITS, quarterValues, TOLERANCE } from '../../models/match'

const SECTIONS = [
  ['sources', 'Sources'],
  ['match', 'How match % works'],
  ['cost', 'How costs are made'],
  ['times', 'How hike times are made'],
  ['limits', 'Honest limits'],
  ['advice', 'Advice vs data'],
] as const

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

export default function About() {
  const { data, index } = useData()
  const { meta } = data

  // Worked example: Angels Landing in Q3 with a 60 to 85 °F limit (falls back to the first hike if it is not in the data).
  const example = useMemo(() => {
    const hike = data.hikes.find((h) => h.id === 'angels-landing') ?? data.hikes[0]
    const months = quarterMonths(index, hike.id, 3)
    const q = quarterValues(months)
    const tempOnly = computeMatch(months, null, { ...NO_LIMITS, temp: [60, 85] })
    const withSmoke = computeMatch(months, null, { ...NO_LIMITS, temp: [60, 85], smoky: 3 })
    return { hike, q, tempOnly, withSmoke, temp: tempOnly.factors.find((f) => f.key === 'temp')!, smoke: withSmoke.factors.find((f) => f.key === 'smoky')! }
  }, [data, index])

  return (
    <main className="page about">
      <Link to="/" className="back"><Icon name="arrow-left" />Back to map</Link>
      <h1>About the data</h1>
      <p className="lede">
        Peak Finder answers three questions in order: <b>where</b> to hike, <b>when</b> (which quarter) and <b>how much</b> it will cost.
        Everything comes from free, public, <em>past</em> data (2015 to 2024, without 2020). We show <b>typical</b> values, never forecasts or price quotes.
        Our pitch: <i>is the travel advice still true?</i> We check common advice against official numbers.
      </p>
      {meta.fake && (
        <p className="about-notice" role="note"><StatusIcon status="warn" size={18} /> <span><b>Work in progress.</b> Crowds, weather, air quality and daylight come from the real sources listed below. Some hikes still use sample data for trailheads, travel, cost or trail profiles, so treat those figures as placeholders until the notice on this page is gone.</span></p>
      )}
      <nav aria-label="On this page" className="about-nav">
        {SECTIONS.map(([id, label]) => <button key={id} type="button" className="fit" onClick={() => go(id)}>{label}</button>)}
      </nav>

      <section id="sources" aria-labelledby="sources-h">
        <h2 id="sources-h">Sources</h2>
        <ul className="about-sources">
          {meta.sources.map((s) => (
            <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> <span>· as of {s.as_of}</span></li>
          ))}
        </ul>
        <p className="fine">Data version {meta.pipeline_version}, built {meta.generated}. The app never calls a live service: it reads files built ahead of time.</p>
        <div className="strip-scroll" role="region" tabIndex={0} aria-label="What each number is and where it comes from, scrolls sideways on small screens">
          <table className="cptable about-table">
            <caption className="sr-only">Each factor, where it comes from and how it is made</caption>
            <thead><tr><th scope="col">Number</th><th scope="col">Source</th><th scope="col">How it is made</th></tr></thead>
            <tbody>
              <tr><th scope="row">Crowds</th><td>NPS Visitor Use Statistics (IRMA), monthly recreation visits</td><td>A month's visits ÷ the park's busiest month (median over years). A <b>park</b> number, not a trail number.</td></tr>
              <tr><th scope="row">Typical high, wet days</th><td>NOAA GHCN-Daily, the nearest weather station within 50 km</td><td>Median daily high per month. A wet day is at least 0.1 in. The summit is estimated at 3.5°F cooler per 1,000 ft and labelled "estimate". No station within 50 km: left out.</td></tr>
              <tr><th scope="row">Smoky days</th><td>EPA AirData, daily AQI for the trailhead's county</td><td>A smoky day has AQI above 100 with fine particles (PM2.5) as the cause. Ozone days are counted separately, because AQI above 100 is not always smoke.</td></tr>
              <tr><th scope="row">Travel time</th><td>OpenRouteService driving times and DOT airfare Table 6 airports</td><td>Door to trailhead from each of the 10 home cities, by the shorter of driving or flying.</td></tr>
              <tr><th scope="row">Daylight</th><td>Computed</td><td>Sunrise and sunset from the trailhead's latitude, longitude and the date.</td></tr>
              <tr><th scope="row">Length, gain, summit elevation</th><td>National Park Service pages</td><td>The NPS numbers, not the length measured from the map (maps shorten switchbacks).</td></tr>
              <tr><th scope="row">Photos</th><td>Wikimedia Commons</td><td>Public domain, CC0, CC BY and CC BY-SA only, always credited.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="match" aria-labelledby="match-h">
        <h2 id="match-h">How match % works</h2>
        <p>
          You set limits (a temperature range, the busiest crowd level, smoky days, wet days, travel time). For each limit that is switched on, a hike scores
          <b> 1</b> inside it and the score falls in a straight line to <b>0</b> at a tolerance beyond it. The match is the average of the scores, times 100:
        </p>
        <p className="formula">match % = 100 × average over the limits you set of max(0, 1 − distance past the limit ÷ tolerance)</p>
        <table className="cptable about-table narrow">
          <caption className="sr-only">Tolerance for each limit</caption>
          <thead><tr><th scope="col">Limit</th><th scope="col">Scores 0 when it is past your limit by</th></tr></thead>
          <tbody>
            <tr><th scope="row">Temperature</th><td>{TOLERANCE.temp}°F outside your range</td></tr>
            <tr><th scope="row">Crowds</th><td>{TOLERANCE.crowd} levels busier (Quiet, Moderate, Busy are one level apart)</td></tr>
            <tr><th scope="row">Smoky days</th><td>{TOLERANCE.smoky} days more in the quarter</td></tr>
            <tr><th scope="row">Wet days</th><td>{TOLERANCE.wet} days more in the quarter</td></tr>
            <tr><th scope="row">Travel time</th><td>{TOLERANCE.travel} hours longer</td></tr>
          </tbody>
        </table>
        <p className="fine">A limit left on "Any" is not counted. A factor with no data is left out of the match and the hike card says so. The tolerances are our starting values and will be tuned after user testing.</p>

        <div className="worked" aria-labelledby="worked-h">
          <h3 id="worked-h">Worked example: {example.hike.name}, Q3 (July to September)</h3>
          <ol>
            <li>
              The typical high for the quarter is the mean of the three monthly medians:{' '}
              <b>{example.q.temp === null ? 'no data' : `${example.q.temp.toFixed(1)}°F`}</b>.
            </li>
            <li>
              Your limit is <b>60 to 85°F</b>. {example.temp.distancePast > 0
                ? <>That is <b>{example.temp.distancePast.toFixed(1)}°F past</b> the top of your range.</>
                : <>That is inside your range.</>}
            </li>
            <li>
              The temperature tolerance is {TOLERANCE.temp}°F, so the score is max(0, 1 − {example.temp.distancePast.toFixed(1)} ÷ {TOLERANCE.temp}) = <b>{example.temp.score.toFixed(2)}</b>.
              With only this limit set, match = 100 × {example.temp.score.toFixed(2)} = <b>{Math.round(example.tempOnly.match)}%</b>.
              {example.tempOnly.greyed && <> A score of 0 turns the map marker into a small <b>hollow grey peak</b> (it stays on the map, with its number).</>}
            </li>
            <li>
              Add a second limit, at most <b>3 smoky days</b>. This hike has about {example.q.smoky === null ? '—' : example.q.smoky.toFixed(1)}, which scores <b>{example.smoke.score.toFixed(2)}</b>.
              The match is the average: 100 × ({example.temp.score.toFixed(2)} + {example.smoke.score.toFixed(2)}) ÷ 2 = <b>{Math.round(example.withSmoke.match)}%</b>.
            </li>
          </ol>
        </div>
        <p className="fine">The best quarter is the one with the highest match; a tie goes to the cheaper one. Cost is shown beside the match, never inside it.</p>
      </section>

      <section id="cost" aria-labelledby="cost-h">
        <h2 id="cost-h">How costs are made</h2>
        <p>A trip's cost is added up from past, typical prices for the hike, your home city and the quarter. It is <b>typical, from past data, not a price quote</b>.</p>
        <ul className="about-list">
          <li><b>Flying:</b> two one-way fares for each traveller, plus a rental car for the days of the trip. <b>Driving:</b> the round-trip miles divided by miles per gallon, times the gas price, for one vehicle per four people.</li>
          <li><b>Lodging:</b> nightly rate times nights times rooms (one room per two people), plus 12% tax. <b>Food:</b> daily meals for each traveller, for the nights plus half a day.</li>
          <li><b>Park fees:</b> entrance fee per vehicle (capped at the $80 annual pass) plus permits. <b>Buffer:</b> 15% of the total, shown hatched.</li>
        </ul>
        <ul className="about-sources">
          {Object.entries(meta.cost_sources).map(([key, s]) => (
            <li key={key}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label} <span>· {s.detail}</span></li>
          ))}
        </ul>
      </section>

      <section id="times" aria-labelledby="times-h">
        <h2 id="times-h">How hike times are made</h2>
        <p>
          Times on the elevation profile come from Tobler's hiking function: your speed on each 10 m step depends on its slope, fastest on a gentle downhill (about 6 km/h) and slower
          the steeper it gets, up or down. We scale distances to the official NPS length, add {STOP_MINUTES} minutes at every stop, and run the profile backwards for the return of an out-and-back hike.
        </p>
        <p className="fine">
          Map elevations are noisy, so we smooth them over about {SMOOTH_WINDOW_M} m and cap the slope at ±{MAX_SLOPE} before applying the function. Otherwise one bad step would add days.
          <b> Global time correction: none yet.</b> We have not yet compared the totals with NPS time estimates for five hikes. If they turn out far off we will apply one correction for all hikes and say so here.
          Sunrise and sunset use the middle month of the quarter. These are typical times for an ordinary walking pace, not a forecast, and your pace will differ.
        </p>
      </section>

      <section id="limits" aria-labelledby="limits-h">
        <h2 id="limits-h">Honest limits</h2>
        <ul className="about-list">
          <li><b>Crowds are for the whole park</b>, not the trail. A quiet-looking month can still be busy at a famous trailhead.</li>
          <li><b>Air quality is for the county</b> of the trailhead, not the trail, and "smoky" means fine-particle AQI above 100, which is not always wildfire smoke.</li>
          <li><b>Weather comes from a station</b> up to 50 km away, so the trail can be hotter, colder or wetter. Summit temperatures are an estimate. With no station in range the factor is left out.</li>
          <li><b>Costs are typical, not quoted.</b> Fares, rooms and gas change daily. We use past averages and add a 15% buffer.</li>
          <li><b>Everything is from past years</b> (2015 to 2024 without 2020). It is not a forecast, and it does not know about this year's closures, fires or permits unless a note says so.</li>
          <li><b>The 3D walks' season maps are illustrative.</b> Snow, leaves and colours show the idea of each season, not a particular year.</li>
          <li><b>Match % depends on tolerances we chose</b> and will change after user testing. It tells you how close a hike is to your limits, not whether it is safe. Check with the park before you go.</li>
        </ul>
      </section>

      <section id="advice" aria-labelledby="advice-h">
        <h2 id="advice-h">Advice vs data</h2>
        <p>Common travel advice, checked against official numbers.</p>
        {data.advice.length === 0 && <p className="fine">No advice cards yet.</p>}
        <ul className="about-advice">
          {data.advice.map((a) => {
            const hike = data.hikes.find((h) => h.id === a.hike_id)
            return (
              <li key={`${a.hike_id}-${a.claim}`}>
                <p className="claim">“{a.claim}”{hike && <> <Link to={`/hike/${hike.id}`} className="fine">{hike.name}</Link></>}</p>
                <p>{a.finding}</p>
                <p className="fine">Source: <a href={a.url} target="_blank" rel="noreferrer">{a.source}</a></p>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
