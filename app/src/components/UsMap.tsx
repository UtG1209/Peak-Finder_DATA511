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
import { DIFFICULTY_COLORS } from '../lib/difficulty'
import type { Difficulty } from '../lib/difficulty'

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
  difficulty: Difficulty
}

/** Imperative controls for the buttons around the map (zoom, zoom to results, whole US). */
export interface MapApi {
  zoomIn: () => void
  zoomOut: () => void
  wholeUs: () => void
  fit: (points: { lat: number; lon: number }[]) => void
  /** Centre on a point in the part of the map not covered by the hike tile. */
  flyTo: (lat: number, lon: number, done?: () => void, zoom?: number) => void
}

interface Props {
  points: MapPoint[]
  highlightId?: string | null
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
  apiRef?: { current: MapApi | null }
}

maplibregl.setWorkerUrl(workerUrl)

const WHOLE_US: [[number, number], [number, number]] = [[-125.5, 23.5], [-66, 50]]
/** Draw the peak markers once as small canvas images (flat fills, no glows). */
function peakImages(): Record<string, ImageData> {
  const draw = (fill: string | null, stroke: string, lw: number): ImageData => {
    const c = document.createElement('canvas')
    c.width = c.height = 48
    const g = c.getContext('2d')!
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(24, 7); g.lineTo(42, 40); g.lineTo(6, 40); g.closePath()
    if (fill) { g.fillStyle = fill; g.fill() }
    g.strokeStyle = stroke; g.lineWidth = lw; g.stroke()
    return g.getImageData(0, 0, 48, 48)
  }
  const out: Record<string, ImageData> = { 'peak-hl': draw('#ffffff', '#ffffff', 6), 'peak-grey': draw(null, '#7b8791', 3.5) }
  for (const d of ['easy', 'moderate', 'hard'] as const) {
    out[`peak-${d}`] = draw(DIFFICULTY_COLORS[d], '#0e1216', 2.5)
    out[`peak-${d}-3d`] = draw(DIFFICULTY_COLORS[d], '#f2efe9', 3)
  }
  return out
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const toGeoJson = (points: MapPoint[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, name: p.name, match: Math.round(p.match), r: bubbleRadius(p.match, p.greyed), greyed: p.greyed, featured: p.featured, difficulty: p.difficulty },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  })),
})

/** MapLibre map of the lower 48: states outline as a vector layer, one bubble per hike. No tiles, no API keys. */
export function UsMap({ points, highlightId, onSelect, onHover, apiRef }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const latest = useRef({ points, onSelect, onHover })
  const shownR = useRef(new Map<string, number>()) // radius currently on screen per hike
  const raf = useRef(0)
  useEffect(() => {
    latest.current = { points, onSelect, onHover }
  })

  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      // no background layer: the pane's CSS gradient shows through, like the prototype
      style: { version: 8, sources: {}, layers: [] },
      bounds: WHOLE_US,
      fitBoundsOptions: { padding: { top: 70, bottom: 70, left: 40, right: 360 } },
      attributionControl: { compact: true, customAttribution: 'US Census via us-atlas' },
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 9,
    })
    map.current = m
    let disposed = false
    // If the container had no size when the map was created (e.g. right after a route change), redraw once it has one.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!disposed) m.resize() }) : null
    ro?.observe(el.current)
    if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = m // handy for debugging and e2e tests

    if (apiRef) {
      const pad = { top: 70, bottom: 70, left: 40, right: 360 }
      apiRef.current = {
        zoomIn: () => m.zoomIn({ duration: reduceMotion() ? 0 : 250 }),
        zoomOut: () => m.zoomOut({ duration: reduceMotion() ? 0 : 250 }),
        wholeUs: () => m.fitBounds(WHOLE_US, { padding: pad, duration: reduceMotion() ? 0 : 500 }),
        fit: (pts) => {
          if (!pts.length) return
          const b = new maplibregl.LngLatBounds()
          pts.forEach((p) => b.extend([p.lon, p.lat]))
          m.fitBounds(b, { padding: pad, maxZoom: 6, duration: reduceMotion() ? 0 : 500 })
        },
        flyTo: (lat, lon, done, zoom = 6) => {
          if (reduceMotion()) {
            m.jumpTo({ center: [lon, lat], zoom, padding: { right: 340, top: 0, bottom: 0, left: 0 } })
            done?.()
            return
          }
          m.once('moveend', () => done?.())
          m.flyTo({ center: [lon, lat], zoom, duration: 450, padding: { right: 340, top: 0, bottom: 0, left: 0 } })
        },
      }
    }

    m.on('load', async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/us-states.topo.json`)
      const topo = (await res.json()) as Topology
      if (disposed) return // the map was removed while the outline was loading (fast route changes)
      const all = feature(topo, topo.objects.states) as unknown as FeatureCollection<Geometry>
      // lower 48 + DC only: drop Alaska (02), Hawaii (15) and territories (>56)
      const lower48 = { ...all, features: all.features.filter((f) => !['02', '15'].includes(String(f.id)) && Number(f.id) <= 56) }
      m.addSource('states', { type: 'geojson', data: lower48 })
      m.addLayer({ id: 'states-fill', type: 'fill', source: 'states', paint: { 'fill-color': '#182027' } })
      m.addLayer({ id: 'states-line', type: 'line', source: 'states', paint: { 'line-color': '#44525e', 'line-width': 1 } })

      m.addSource('hikes', { type: 'geojson', data: toGeoJson(latest.current.points) })
      for (const [name, data] of Object.entries(peakImages())) m.addImage(name, data, { pixelRatio: 2 })
      // One flat peak per hike: colour = difficulty, size = match. Hikes past a limit are small hollow grey peaks. 3D-walk hikes have a white outline.
      const size = (k: number): maplibregl.ExpressionSpecification => ['*', ['get', 'r'], k]
      m.addLayer({
        id: 'hikes-hl', type: 'symbol', source: 'hikes', filter: ['==', ['get', 'id'], ''],
        layout: { 'icon-image': 'peak-hl', 'icon-size': size(0.2), 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      })
      m.addLayer({
        id: 'hikes', type: 'symbol', source: 'hikes',
        layout: {
          'icon-image': ['case', ['get', 'greyed'], 'peak-grey', ['concat', 'peak-', ['get', 'difficulty'], ['case', ['get', 'featured'], '-3d', '']]],
          'icon-size': size(0.13),
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          // greyed peaks underneath, then big ones before small ones so a small peak is never hidden behind a large one
          'symbol-sort-key': ['case', ['get', 'greyed'], -100, ['*', ['get', 'r'], -1]],
        },
      })
      shownR.current = new Map(latest.current.points.map((p) => [p.id, bubbleRadius(p.match, p.greyed)]))

      m.on('mousemove', 'hikes', (e) => {
        m.getCanvas().style.cursor = 'pointer'
        latest.current.onHover?.(String(e.features?.[0]?.properties?.id ?? '') || null)
      })
      m.on('mouseleave', 'hikes', () => {
        m.getCanvas().style.cursor = ''
        latest.current.onHover?.(null)
      })
      m.on('click', 'hikes', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) latest.current.onSelect(String(id))
      })
    })
    return () => {
      disposed = true
      ro?.disconnect()
      if (apiRef) apiRef.current = null
      m.remove()
      map.current = null
    }
  }, [apiRef])

  // Peaks resize over ~400 ms when the quarter changes (symbol sizes cannot be transitioned by MapLibre, so we step the radius ourselves).
  useEffect(() => {
    const src = map.current?.getSource('hikes') as maplibregl.GeoJSONSource | undefined
    if (!src) return
    cancelAnimationFrame(raf.current)
    const from = new Map(shownR.current)
    const to = new Map(points.map((p) => [p.id, bubbleRadius(p.match, p.greyed)]))
    const draw = (k: number) => {
      const cur = new Map<string, number>()
      const fc = toGeoJson(points)
      for (const f of fc.features) {
        const id = String(f.properties?.id)
        const t = to.get(id) ?? 0
        const r = from.has(id) ? from.get(id)! + (t - from.get(id)!) * k : t
        cur.set(id, r)
        f.properties = { ...f.properties, r }
      }
      shownR.current = cur
      src.setData(fc)
    }
    if (reduceMotion()) return draw(1)
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 400)
      draw(k * (2 - k)) // ease out
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [points])

  useEffect(() => {
    const m = map.current
    if (m?.getLayer('hikes-hl')) m.setFilter('hikes-hl', ['==', ['get', 'id'], highlightId ?? ''])
  }, [highlightId])

  return <div ref={el} className="us-map" role="application" aria-label="Map of hikes. The ranked list beside it has the same information." />
}
