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
import { DIFFICULTY_COLORS, hexToRgba } from '../lib/difficulty'
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
  flyTo: (lat: number, lon: number, done?: () => void) => void
  /** Where the map is looking now, so Back from a hike page can return to the same view. */
  getView: () => MapView
}

export interface MapView {
  center: [number, number]
  zoom: number
}

interface Props {
  points: MapPoint[]
  /** The chosen home city, drawn as a marker. null = "Skip". */
  home?: { name: string; lat: number; lon: number } | null
  /** Open at this view instead of the whole US (used when coming Back from a hike page). */
  initialView?: MapView | null
  highlightId?: string | null
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
  apiRef?: { current: MapApi | null }
}

maplibregl.setWorkerUrl(workerUrl)

const WHOLE_US: [[number, number], [number, number]] = [[-125.5, 23.5], [-66, 50]]
const byDifficulty = (fn: (hex: string) => string): maplibregl.ExpressionSpecification => [
  'match', ['get', 'difficulty'],
  'easy', fn(DIFFICULTY_COLORS.easy),
  'moderate', fn(DIFFICULTY_COLORS.moderate),
  'hard', fn(DIFFICULTY_COLORS.hard),
  '#b4bcc3',
]
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const RESIZE_MS = 400 // bubbles grow and shrink over about 400 ms when the quarter or a limit changes

/** `radii` overrides each bubble's radius while a resize is in flight (id -> px). */
const toGeoJson = (points: MapPoint[], radii?: Map<string, number>): FeatureCollection => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, name: p.name, match: Math.round(p.match), r: radii?.get(p.id) ?? bubbleRadius(p.match, p.greyed), greyed: p.greyed, featured: p.featured, difficulty: p.difficulty },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  })),
})

/** MapLibre map of the lower 48: states outline as a vector layer, one bubble per hike. No tiles, no API keys. */
export function UsMap({ points, home, initialView, highlightId, onSelect, onHover, apiRef }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const latest = useRef({ points, onSelect, onHover })
  const startView = useRef(initialView) // only read when the map is created
  const drawn = useRef(new Map<string, number>()) // radius each bubble is drawn at right now
  const frame = useRef(0)
  useEffect(() => {
    latest.current = { points, onSelect, onHover }
  })

  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      // no background layer: the pane's CSS gradient shows through, like the prototype
      style: { version: 8, sources: {}, layers: [] },
      ...(startView.current
        ? { center: startView.current.center, zoom: startView.current.zoom }
        : { bounds: WHOLE_US, fitBoundsOptions: { padding: { top: 70, bottom: 70, left: 40, right: 360 } } }),
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
    // Handy for debugging, and the browser test uses it to click a bubble (it runs against the production build).
    ;(window as unknown as { __map?: maplibregl.Map }).__map = m

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
        getView: () => ({ center: [m.getCenter().lng, m.getCenter().lat], zoom: m.getZoom() }),
        flyTo: (lat, lon, done) => {
          if (reduceMotion()) {
            m.jumpTo({ center: [lon, lat], zoom: 6 })
            done?.()
            return
          }
          m.once('moveend', () => done?.())
          m.flyTo({ center: [lon, lat], zoom: 6, duration: 450 })
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
      drawn.current = new Map(latest.current.points.map((p) => [p.id, bubbleRadius(p.match, p.greyed)]))
      const notGrey = ['!', ['get', 'greyed']] as maplibregl.ExpressionSpecification
      m.addLayer({ id: 'hikes-halo', type: 'circle', source: 'hikes', filter: notGrey, paint: { 'circle-radius': ['+', ['get', 'r'], 5], 'circle-color': byDifficulty((h) => hexToRgba(h, 0.28)) } })
      // featured 3D hikes carry a thin outer ring
      m.addLayer({ id: 'hikes-ring', type: 'circle', source: 'hikes', filter: ['==', ['get', 'featured'], true], paint: { 'circle-radius': ['+', ['get', 'r'], 8], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#f2efe9', 'circle-stroke-width': 1.2 } })
      m.addLayer({
        id: 'hikes', type: 'circle', source: 'hikes',
        paint: {
          'circle-radius': ['get', 'r'],
          'circle-color': ['case', ['get', 'greyed'], '#101418', byDifficulty((h) => h)],
          'circle-stroke-color': ['case', ['get', 'greyed'], '#7b8791', '#101418'],
          'circle-stroke-width': ['case', ['get', 'greyed'], 1.5, 1],
        },
      })
      m.addLayer({ id: 'hikes-hl', type: 'circle', source: 'hikes', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': ['+', ['get', 'r'], 11], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } })

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

  // Resize the bubbles over ~400 ms. MapLibre does not animate a data-driven radius when the source data changes
  // (its circle-radius-transition only covers constant values), so each frame writes in-between radii to the source.
  // With prefers-reduced-motion the bubbles jump straight to their new size.
  useEffect(() => {
    const src = map.current?.getSource('hikes') as maplibregl.GeoJSONSource | undefined
    if (!src) return // the map is still loading: its first data comes from `latest` at load time
    cancelAnimationFrame(frame.current)
    const target = new Map(points.map((p) => [p.id, bubbleRadius(p.match, p.greyed)]))
    const from = new Map(drawn.current)
    const apply = (radii: Map<string, number>) => {
      drawn.current = radii
      src.setData(toGeoJson(points, radii))
    }
    if (reduceMotion() || from.size === 0) {
      apply(target)
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / RESIZE_MS)
      const e = 1 - Math.pow(1 - t, 3) // ease out
      const radii = new Map<string, number>()
      for (const [id, to] of target) {
        const f = from.get(id) ?? to
        radii.set(id, f + (to - f) * e)
      }
      apply(radii)
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [points])

  // home city marker: a labelled diamond, kept as a DOM marker so it needs no font files
  useEffect(() => {
    const m = map.current
    if (!m || !home) return
    const node = document.createElement('div')
    node.className = 'home-marker'
    node.innerHTML = '<i aria-hidden="true"></i><span></span>'
    node.querySelector('span')!.textContent = `${home.name} (home)`
    const marker = new maplibregl.Marker({ element: node }).setLngLat([home.lon, home.lat]).addTo(m)
    return () => { marker.remove() }
  }, [home?.name, home?.lat, home?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (m?.getLayer('hikes-hl')) m.setFilter('hikes-hl', ['==', ['get', 'id'], highlightId ?? ''])
  }, [highlightId])

  return <div ref={el} className="us-map" role="application" aria-label="Map of hikes. The ranked list beside it has the same information." />
}
