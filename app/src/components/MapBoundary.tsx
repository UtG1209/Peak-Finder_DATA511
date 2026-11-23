// Error boundary around the lazy 2D map. If WebGL is missing or MapLibre throws (or its chunk fails to load) the map pane shows a calm
// message and the rest of Explore (rail, ranked list, hike card) keeps working. Before this, one thrown error blanked the whole page.
import { Component, type ReactNode } from 'react'
import { webglAvailable } from '../screens/Explore/view3d/webgl'

interface State { failed: boolean }

export class MapBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State { return { failed: true } }
  componentDidCatch(error: unknown) {
    console.warn('Map could not start:', error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    const noGl = !webglAvailable()
    return (
      <div className="map-fail" role="status">
        <p className="map-fail-msg">
          {noGl
            ? 'The map needs WebGL, which this browser does not offer. The ranked list on the left has every hike.'
            : 'The map could not load. The ranked list on the left has every hike.'}
        </p>
        {!noGl && <button type="button" className="go" onClick={() => this.setState({ failed: false })}>Try again</button>}
      </div>
    )
  }
}
