// 3D view of the hikes (opt-in, lazy chunk: see Explore.tsx). Mounts a vanilla three.js renderer imperatively, like UsMap.tsx.
// It draws the same points the 2D map gets; hover and click go through the same Explore handlers (same tile, same `pick` flow).
import { useEffect, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { MapPoint } from '../../../components/UsMap'
import { lower48, makeProjector } from './projection'
import { createExploreScene, type SceneHandle } from './scene'
import { useMapColors } from '../../../lib/themeColors'

interface Props {
  points: MapPoint[]
  hoverId: string | null
  pickedId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function View3D({ points, hoverId, pickedId, onHover, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<SceneHandle | null>(null)
  const latest = useRef({ onHover, onSelect })
  const colors = useMapColors()
  const colorsRef = useRef(colors)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    latest.current = { onHover, onSelect }
    colorsRef.current = colors
  })

  useEffect(() => {
    const el = host.current
    if (!el) return
    // The canvas is created here (not in JSX) so a StrictMode remount gets a fresh WebGL context after dispose.
    const canvas = document.createElement('canvas')
    canvas.className = 'v3d-canvas'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Loading the 3D view of hikes')
    canvas.style.touchAction = 'none'
    el.appendChild(canvas)
    let handle: SceneHandle
    try {
      handle = createExploreScene(canvas, { reduceMotion: reduceMotion(), colors: colorsRef.current })
    } catch {
      canvas.remove()
      queueMicrotask(() => setFailed(true))
      return
    }
    scene.current = handle
    handle.callbacks.onHover = (id) => latest.current.onHover(id)
    handle.callbacks.onSelect = (id) => latest.current.onSelect(id)
    const size = () => handle.setSize(el.clientWidth, el.clientHeight)
    size()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null
    ro?.observe(el)
    let disposed = false
    fetch(`${import.meta.env.BASE_URL}data/us-states.topo.json`)
      .then((r) => r.json() as Promise<Topology>)
      .then((topo) => {
        if (disposed) return
        const all = feature(topo, topo.objects.states) as unknown as FeatureCollection<Geometry>
        const states = lower48(all)
        handle.setStates(states, makeProjector(states))
        canvas.dataset.ready = '1'
      })
      .catch(() => { if (!disposed) setFailed(true) })
    return () => {
      disposed = true
      ro?.disconnect()
      handle.dispose()
      canvas.remove()
      scene.current = null
    }
  }, [])

  // Theme switch: recolour in place (declared before the peaks effect so a first render never draws old colours)
  useEffect(() => { scene.current?.setColors(colors) }, [colors])

  useEffect(() => {
    scene.current?.setPeaks(
      points.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, match: p.match, greyed: p.greyed, featured: p.featured, difficulty: p.difficulty })),
      hoverId,
      pickedId,
    )
    const canvas = scene.current?.canvas
    if (canvas) {
      const fit = points.filter((p) => !p.greyed).length
      canvas.setAttribute('aria-label', `3D view of ${points.length} hikes as peaks on a map of the lower 48 states. ${fit} fit your limits. Taller peaks match better. The ranked list has the same information.`)
    }
  }, [points, hoverId, pickedId])

  return (
    <div className="v3d-scene">
      <div ref={host} className="v3d-host" />
      <button type="button" className="v3d-reset" onClick={() => scene.current?.resetView()}>Reset view</button>
      <div className="v3d-hint">Drag to orbit · scroll to zoom · right-drag to pan · click a peak to preview it</div>
      {failed && <div className="v3d-fail" role="alert">The 3D view could not start. Switch back to the 2D map.</div>}
    </div>
  )
}
