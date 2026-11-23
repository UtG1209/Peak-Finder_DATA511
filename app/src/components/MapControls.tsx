// Buttons over the 2D map: zoom in / out, zoom to the hikes that fit, whole US. They drive the map through MapApi (UsMap fills apiRef).
// Hidden until "Show hikes" and in the 3D view (which has its own Reset view). Styles: #zoomctl in styles/map.css.
import type { MapApi } from './UsMap'
import { Icon } from './Icon'

interface Props {
  apiRef: { current: MapApi | null }
  hidden: boolean
  /** Trailheads of the hikes that currently fit the limits. */
  resultPoints: () => { lat: number; lon: number }[]
}

export function MapControls({ apiRef, hidden, resultPoints }: Props) {
  return (
    <div id="zoomctl" role="group" aria-label="Map controls" hidden={hidden}>
      <button type="button" className="zb txt" onClick={() => apiRef.current?.fit(resultPoints())}>Zoom to results</button>
      <button type="button" className="zb" aria-label="Zoom in" onClick={() => apiRef.current?.zoomIn()}><Icon name="plus" /></button>
      <button type="button" className="zb" aria-label="Zoom out" onClick={() => apiRef.current?.zoomOut()}><Icon name="minus" /></button>
      <button type="button" className="zb txt" onClick={() => apiRef.current?.wholeUs()}>Whole US</button>
    </div>
  )
}
