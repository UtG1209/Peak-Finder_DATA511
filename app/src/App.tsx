import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { DataContext } from './data/DataContext'
import { useDataset } from './data/useDataset'
import { FakeBanner } from './components/FakeBanner'
import Explore from './screens/Explore/Explore'
import Hike from './screens/Hike/Hike'
import About from './screens/About/About'

// HashRouter keeps deep links working on GitHub Pages without a 404 fallback; filters live in the query part:
//   https://<site>/#/?from=SEA&q=3&temp=55-80
export default function App() {
  const state = useDataset()

  if (state.status === 'loading') {
    return (
      <div className="boot" aria-busy="true">
        <div className="skeleton" />
        <p>Loading hikes…</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="boot">
        <p role="alert">We could not load the data. {state.message}</p>
        <button type="button" onClick={state.retry}>Retry</button> · <a href="#/about">About the data</a>
      </div>
    )
  }

  return (
    <DataContext.Provider value={{ data: state.data, index: state.index }}>
      <HashRouter>
        <div className="shell">
        <FakeBanner meta={state.data.meta} />
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/hike/:id" element={<Hike />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<p className="boot">Page not found. <Link to="/">Back to the map</Link></p>} />
        </Routes>
        </div>
      </HashRouter>
    </DataContext.Provider>
  )
}
