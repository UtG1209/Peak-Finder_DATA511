import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
// Bundle MapLibre's worker (with its shared chunk) as one file and tell the library where it is.
// Without this the worker fails to load in the production build and on GitHub Pages.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import { bubbleRadius } from '../lib/bubbles'

export interface MapPoint {
  id: string
  name: string
  lat: number
  lon: number
  /** 0..100: bubble AREA is proportional to this. */
  match: number
  /** Fails a limit: drawn as a small hollow grey dot (never removed). */
  greyed: boolean
  featured: boolean
}

interface Props {
  points: MapPoint[]
  highlightId?: string | null
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
}

maplibregl.setWorkerUrl(workerUrl)

const WHOLE_US: [[number, number], [number, number]] = [[-125.5, 24], [-66, 49.8]]

const toGeoJson = (points: MapPoint[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    id: undefined,
    properties: { id: p.id, name: p.name, match: Math.round(p.match), r: bubbleRadius(p.match, p.greyed), greyed: p.greyed, featured: p.featured },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  })),
})

/** MapLibre map of the lower 48: states outline as a vector layer, one bubble per hike. No tiles, no API keys. */
export function UsMap({ points, highlightId, onSelect, onHover }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const latest = useRef({ points, onSelect, onHover })
  useEffect(() => {
    latest.current = { points, onSelect, onHover }
  })

  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef3f3' } }] },
      bounds: WHOLE_US,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true, customAttribution: 'US Census via us-atlas' },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.current = m
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    m.on('load', async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/us-states.topo.json`)
      const topo = (await res.json()) as Topology
      const all = feature(topo, topo.objects.states) as unknown as FeatureCollection<Geometry>
      // lower 48 + DC only: drop Alaska (02), Hawaii (15) and territories (>56)
      const lower48 = { ...all, features: all.features.filter((f) => !['02', '15'].includes(String(f.id)) && Number(f.id) <= 56) }
      m.addSource('states', { type: 'geojson', data: lower48 })
      m.addLayer({ id: 'states-fill', type: 'fill', source: 'states', paint: { 'fill-color': '#ffffff' } })
      m.addLayer({ id: 'states-line', type: 'line', source: 'states', paint: { 'line-color': '#9fb1b3', 'line-width': 1 } })

      m.addSource('hikes', { type: 'geojson', data: toGeoJson(latest.current.points) })
      // featured 3D hikes carry a thin outer ring
      m.addLayer({ id: 'hikes-ring', type: 'circle', source: 'hikes', filter: ['==', ['get', 'featured'], true], paint: { 'circle-radius': ['+', ['get', 'r'], 4], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#0f766e', 'circle-stroke-width': 1.5 } })
      m.addLayer({
        id: 'hikes', type: 'circle', source: 'hikes',
        paint: {
          'circle-radius': ['get', 'r'],
          'circle-color': ['case', ['get', 'greyed'], 'rgba(255,255,255,0)', 'rgba(15,118,110,0.78)'],
          'circle-stroke-color': ['case', ['get', 'greyed'], '#7b8791', '#0b5e57'],
          'circle-stroke-width': ['case', ['get', 'greyed'], 1.5, 1],
          'circle-radius-transition': { duration: 400, delay: 0 }, // bubbles resize over ~400 ms when the quarter changes
        },
      })
      m.addLayer({ id: 'hikes-hl', type: 'circle', source: 'hikes', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': ['+', ['get', 'r'], 6], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#111827', 'circle-stroke-width': 2 } })

      m.on('mouseenter', 'hikes', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'hikes', () => {
        m.getCanvas().style.cursor = ''
        latest.current.onHover?.(null)
      })
      m.on('mousemove', 'hikes', (e) => latest.current.onHover?.(String(e.features?.[0]?.properties?.id ?? '') || null))
      m.on('click', 'hikes', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) latest.current.onSelect(String(id))
      })
    })
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const src = m?.getSource('hikes') as maplibregl.GeoJSONSource | undefined
    src?.setData(toGeoJson(points))
  }, [points])

  useEffect(() => {
    const m = map.current
    if (m?.getLayer('hikes-hl')) m.setFilter('hikes-hl', ['==', ['get', 'id'], highlightId ?? ''])
  }, [highlightId])

  return <div ref={el} className="us-map" role="application" aria-label="Map of hikes. The ranked list beside it has the same information." />
}
