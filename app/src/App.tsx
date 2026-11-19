import { lazy, Suspense } from 'react'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { DataContext } from './data/DataContext'
import { useDataset } from './data/useDataset'
import { FakeBanner } from './components/FakeBanner'
// Each screen is its own chunk: the hike page (charts) and About load only when visited.
const Explore = lazy(() => import('./screens/Explore/Explore'))
const Hike = lazy(() => import('./screens/Hike/Hike'))
const About = lazy(() => import('./screens/About/About'))

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
        <Suspense fallback={<div className="boot" aria-busy="true"><div className="skeleton" /></div>}>
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/hike/:id" element={<Hike />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<p className="boot">Page not found. <Link to="/">Back to the map</Link></p>} />
        </Routes>
        </Suspense>
        </div>
      </HashRouter>
    </DataContext.Provider>
  )
}
