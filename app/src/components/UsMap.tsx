import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
// Bundle MapLibre's worker (with its shared chunk) as one file and tell the library where it is.
// Without this the worker fails to load in the production build and on GitHub Pages.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import { bubbleRadius, separate } from '../lib/bubbles'
import type { Difficulty } from '../lib/difficulty'
import { useMapColors, type MapColors } from '../lib/themeColors'

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
/** Peaks closer than this many screen px are nudged apart (see separate() in lib/bubbles.ts). */
const MIN_GAP_PX = 14
const DIFFICULTIES = ['easy', 'moderate', 'hard'] as const

/** Draw the peak markers as small canvas images (flat fills, no glows) in the colours of the current theme. */
function peakImages(c: MapColors): Record<string, ImageData> {
  const tri = (g: CanvasRenderingContext2D) => {
    g.beginPath()
    g.moveTo(24, 7); g.lineTo(42, 40); g.lineTo(6, 40); g.closePath()
  }
  const draw = (fill: string | null, stroke: string, lw: number, halo?: string): ImageData => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 48
    const g = cv.getContext('2d')!
    g.lineJoin = 'round'
    tri(g)
    if (halo) { g.strokeStyle = halo; g.lineWidth = lw + 3.5; g.stroke() } // a halo under the line keeps it readable on light and dark land
    if (fill) { g.fillStyle = fill; g.fill() }
    g.strokeStyle = stroke; g.lineWidth = lw; g.stroke()
    return g.getImageData(0, 0, 48, 48)
  }
  // 'peak-hl' is drawn bigger on the map (icon-size x1.4): a crisp ring around the marker, never a filled blob.
  const out: Record<string, ImageData> = { 'peak-hl': draw(null, c.ink, 2.5, c.halo), 'peak-grey': draw(null, c.off, 3.5, c.halo) }
  for (const d of DIFFICULTIES) {
    out[`peak-${d}`] = draw(c.diff[d], c.halo, 2.5)
    out[`peak-${d}-3d`] = draw(c.diff[d], c.ink, 3, c.halo)
  }
  return out
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** `placed` holds the nudged position of crowded peaks (id -> [lon, lat]); every other peak sits at its trailhead. */
const toGeoJson = (points: MapPoint[], placed?: Map<string, [number, number]>): FeatureCollection => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, name: p.name, match: Math.round(p.match), r: bubbleRadius(p.match, p.greyed), greyed: p.greyed, featured: p.featured, difficulty: p.difficulty },
    geometry: { type: 'Point', coordinates: placed?.get(p.id) ?? [p.lon, p.lat] },
  })),
})

type Pad = { top: number; bottom: number; left: number; right: number }
const phoneLayout = () => typeof matchMedia === 'function' && matchMedia('(max-width: 860px)').matches
/** Room kept free around the hikes: desktop leaves the right side for the tile; on phone the legend sits on top and the bottom sheet or tile at the bottom. */
const framePad = (): Pad => (phoneLayout() ? { top: 130, bottom: 290, left: 24, right: 24 } : { top: 70, bottom: 70, left: 40, right: 360 })
/** Padding for flyTo: keeps the picked trailhead clear of the desktop tile (right) or the phone tile (bottom). */
const focusPad = (): Pad => (phoneLayout() ? { top: 120, bottom: 360, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 340 })

/** MapLibre map of the lower 48: states outline as a vector layer, one bubble per hike. No tiles, no API keys. */
export function UsMap({ points, highlightId, onSelect, onHover, apiRef }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const latest = useRef({ points, onSelect, onHover })
  const shownR = useRef(new Map<string, number>()) // radius currently on screen per hike
  const raf = useRef(0)
  const placed = useRef(new Map<string, [number, number]>()) // nudged positions of crowded peaks at the current zoom
  const highlightRef = useRef<string | null>(highlightId ?? null)
  const colors = useMapColors()
  const colorsRef = useRef(colors)
  useEffect(() => {
    latest.current = { points, onSelect, onHover }
    colorsRef.current = colors
    highlightRef.current = highlightId ?? null
  })

  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      // no background layer: the pane's flat var(--map-sea) shows through, so the theme switch needs no map work for the sea
      style: { version: 8, sources: {}, layers: [] },
      bounds: WHOLE_US,
      fitBoundsOptions: { padding: framePad() },
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
      apiRef.current = {
        zoomIn: () => m.zoomIn({ duration: reduceMotion() ? 0 : 250 }),
        zoomOut: () => m.zoomOut({ duration: reduceMotion() ? 0 : 250 }),
        wholeUs: () => m.fitBounds(WHOLE_US, { padding: framePad(), duration: reduceMotion() ? 0 : 500 }),
        fit: (pts) => {
          if (!pts.length) return
          const b = new maplibregl.LngLatBounds()
          pts.forEach((p) => b.extend([p.lon, p.lat]))
          m.fitBounds(b, { padding: framePad(), maxZoom: 6, duration: reduceMotion() ? 0 : 500 })
        },
        flyTo: (lat, lon, done, zoom = 6) => {
          if (reduceMotion()) {
            m.jumpTo({ center: [lon, lat], zoom, padding: focusPad() })
            done?.()
            return
          }
          m.once('moveend', () => done?.())
          m.flyTo({ center: [lon, lat], zoom, duration: 450, padding: focusPad() })
        },
      }
    }

    // Crowded trailheads (Utah/Arizona) are nudged a few px apart at the current zoom; the real coordinates still drive flyTo and the data.
    const nudge = () => {
      if (disposed || !m.getSource('hikes')) return
      const pts = latest.current.points
      const next = new Map<string, [number, number]>()
      const offs = separate(pts.map((p) => { const s = m.project([p.lon, p.lat]); return { id: p.id, x: s.x, y: s.y } }), MIN_GAP_PX)
      for (const p of pts) {
        const o = offs.get(p.id)
        if (!o) continue
        const s = m.project([p.lon, p.lat])
        const ll = m.unproject([s.x + o[0], s.y + o[1]])
        next.set(p.id, [ll.lng, ll.lat])
      }
      placed.current = next
      drawNow()
    }
    // Push the current radii and nudged positions to the map.
    const drawNow = () => {
      const src = m.getSource('hikes') as maplibregl.GeoJSONSource | undefined
      if (!src) return
      const fc = toGeoJson(latest.current.points, placed.current)
      for (const f of fc.features) { const r = shownR.current.get(String(f.properties?.id)); if (r !== undefined) f.properties = { ...f.properties, r } }
      src.setData(fc)
    }

    m.on('load', async () => {
      let res: Response
      try { res = await fetch(`${import.meta.env.BASE_URL}data/us-states.topo.json`) } catch { return } // outline missing: peaks-less map, the list still works
      const topo = (await res.json()) as Topology
      if (disposed) return // the map was removed while the outline was loading (fast route changes)
      const all = feature(topo, topo.objects.states) as unknown as FeatureCollection<Geometry>
      // lower 48 + DC only: drop Alaska (02), Hawaii (15) and territories (>56)
      const lower48 = { ...all, features: all.features.filter((f) => !['02', '15'].includes(String(f.id)) && Number(f.id) <= 56) }
      const c = colorsRef.current
      m.addSource('states', { type: 'geojson', data: lower48 })
      m.addLayer({ id: 'states-fill', type: 'fill', source: 'states', paint: { 'fill-color': c.land } })
      m.addLayer({ id: 'states-line', type: 'line', source: 'states', paint: { 'line-color': c.border, 'line-width': 1 } })

      m.addSource('hikes', { type: 'geojson', data: toGeoJson(latest.current.points) })
      for (const [name, data] of Object.entries(peakImages(c))) m.addImage(name, data, { pixelRatio: 2 })
      // One flat peak per hike: colour = difficulty, size = match. Hikes past a limit are small hollow grey peaks. 3D-walk hikes have a white outline.
      const size = (k: number): maplibregl.ExpressionSpecification => ['*', ['get', 'r'], k]
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
      // hover / selected: a crisp ring one step bigger than the marker, on top of it
      m.addLayer({
        id: 'hikes-hl', type: 'symbol', source: 'hikes', filter: ['==', ['get', 'id'], highlightRef.current ?? ''],
        layout: { 'icon-image': 'peak-hl', 'icon-size': size(0.13 * 1.4), 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      })
      shownR.current = new Map(latest.current.points.map((p) => [p.id, bubbleRadius(p.match, p.greyed)]))
      nudge()
      m.on('zoomend', nudge)

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
      const fc = toGeoJson(points, placed.current)
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

  // Theme switch: recolour the land and outline and redraw the marker images in place (no map re-creation).
  useEffect(() => {
    const m = map.current
    if (!m || !m.getLayer('states-fill')) return // not loaded yet: the load handler reads the current colours
    m.setPaintProperty('states-fill', 'fill-color', colors.land)
    m.setPaintProperty('states-line', 'line-color', colors.border)
    for (const [name, data] of Object.entries(peakImages(colors))) if (m.hasImage(name)) m.updateImage(name, data)
  }, [colors])

  useEffect(() => {
    const m = map.current
    if (m?.getLayer('hikes-hl')) m.setFilter('hikes-hl', ['==', ['get', 'id'], highlightId ?? ''])
  }, [highlightId])

  return <div ref={el} className="us-map" role="application" aria-label="Map of hikes. The ranked list beside it has the same information." />
}
