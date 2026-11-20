// Vanilla three.js scene for the 3D view: the lower 48 as thin flat extruded shapes (merged into two meshes) and
// the 40 hikes as ONE InstancedMesh of cones. Colour = difficulty, height = match %, a grey short cone = filtered out.
// Rendering is ON DEMAND: nothing runs unless the camera, the data or the size changes (no loop, no auto-rotate).
import {
  AmbientLight, BufferGeometry, Color, ConeGeometry, DirectionalLight, DynamicDrawUsage, ExtrudeGeometry, Float32BufferAttribute,
  InstancedMesh, LineBasicMaterial, LineSegments, Material, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D,
  PerspectiveCamera, Quaternion, Raycaster, RingGeometry, Scene, Shape, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import type { Difficulty } from '../../../lib/difficulty'
import type { MapColors } from '../../../lib/themeColors'
import { SCENE_WIDTH, type Projector } from './projection'

export interface PeakPoint {
  id: string
  lat: number
  lon: number
  /** 0..100 */
  match: number
  greyed: boolean
  featured: boolean
  difficulty: Difficulty
}

export interface SceneCallbacks {
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

export interface SceneHandle {
  canvas: HTMLCanvasElement
  callbacks: SceneCallbacks
  setStates: (states: FeatureCollection<Geometry>, project: Projector) => void
  /** Recolour for a theme change: states, border, peaks, rings. Touches materials and instance colours only, no geometry is rebuilt. */
  setColors: (colors: MapColors) => void
  setPeaks: (points: PeakPoint[], hoverId: string | null, pickedId: string | null) => void
  setSize: (w: number, h: number) => void
  resetView: () => void
  /** Id of the peak under a screen position, or null (used by hover and click, and by tests). */
  pickAt: (clientX: number, clientY: number) => string | null
  /** Number of peaks currently drawn (for tests and the aria label). */
  peakCount: () => number
  dispose: () => void
}

const MAX_PEAKS = 128
const FOV = 35
const TILT = (52 * Math.PI) / 180 // camera elevation above the ground

/** Height and base radius of a peak (scene units; the country is ~100 wide). Pure, so it is easy to test. */
export function peakSize(match: number, greyed: boolean): { h: number; r: number } {
  if (greyed) return { h: 0.8, r: 0.45 }
  const m = Math.max(0, Math.min(100, match)) / 100
  return { h: 1.6 + 5.4 * m, r: 0.7 + 0.5 * m }
}

function ringsOf(g: Geometry): Position[][][] {
  if (g.type === 'Polygon') return [g.coordinates]
  if (g.type === 'MultiPolygon') return g.coordinates
  return []
}

export function createExploreScene(canvas: HTMLCanvasElement, opts: { reduceMotion: boolean; colors: MapColors }): SceneHandle {
  let colors = opts.colors // land = states, border, off = filtered-out peaks, ink = ring and hover/selected, diff = difficulty
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0) // the pane's own background shows through

  const scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.6))
  const sun = new DirectionalLight(0xffffff, 1.4)
  sun.position.set(-40, 80, 50)
  scene.add(sun)

  const camera = new PerspectiveCamera(FOV, 1, 1, 600)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !opts.reduceMotion
  controls.minDistance = 25
  controls.maxDistance = 220
  controls.maxPolarAngle = (80 * Math.PI) / 180
  controls.screenSpacePanning = false

  let size = { w: 1, h: 1 }
  let userMoved = false // until the user touches the camera, a resize re-fits the country
  let disposed = false
  let raf = 0
  const fitCamera = () => {
    const aspect = size.w / size.h
    const t = Math.tan((FOV * Math.PI) / 360)
    const d = Math.max((SCENE_WIDTH / 2) * 1.12 / (t * aspect), 34 / t / 1.1)
    controls.target.set(0, 0, 0)
    camera.position.set(0, d * Math.sin(TILT), d * Math.cos(TILT))
    camera.lookAt(0, 0, 0)
    controls.update()
  }

  const requestRender = () => {
    if (raf || disposed) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (disposed) return
      controls.update() // may fire 'change' again while damping settles, which schedules one more frame
      renderer.render(scene, camera)
    })
  }
  controls.addEventListener('change', requestRender)
  controls.addEventListener('start', () => { userMoved = true })

  // ---- states ----
  let statesMeshes: Object3D[] = []
  const stateMat = new MeshBasicMaterial({ color: colors.land })
  const lineMat = new LineBasicMaterial({ color: colors.border })
  const setStates: SceneHandle['setStates'] = (states, project) => {
    for (const o of statesMeshes) { scene.remove(o); (o as Mesh).geometry?.dispose() }
    const parts: BufferGeometry[] = []
    const lines: number[] = []
    for (const f of states.features) {
      for (const poly of ringsOf(f.geometry)) {
        const toVec = (ring: Position[]) => ring.map(([lon, lat]) => { const [x, z] = project(lon, lat); return new Vector2(x, z) })
        const shape = new Shape(toVec(poly[0]))
        for (const hole of poly.slice(1)) shape.holes.push(new Shape(toVec(hole)))
        const g = new ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false })
        g.deleteAttribute('uv')
        g.deleteAttribute('normal')
        g.rotateX(Math.PI / 2) // shape y -> scene z, extrusion goes down from y = 0
        parts.push(g)
        for (const ring of poly) {
          const pts = toVec(ring)
          for (let i = 0; i < pts.length - 1; i++) lines.push(pts[i].x, 0.03, pts[i].y, pts[i + 1].x, 0.03, pts[i + 1].y)
        }
      }
    }
    const merged = mergeGeometries(parts, false)
    parts.forEach((g) => g.dispose())
    const ground = new Mesh(merged, stateMat)
    const lg = new BufferGeometry()
    lg.setAttribute('position', new Float32BufferAttribute(lines, 3))
    const border = new LineSegments(lg, lineMat)
    statesMeshes = [ground, border]
    scene.add(ground, border)
    projector = project
    layout()
    requestRender()
  }

  // ---- peaks ----
  const coneGeo = new ConeGeometry(1, 1, 5)
  coneGeo.translate(0, 0.5, 0) // base on the ground, tip up
  const peaks = new InstancedMesh(coneGeo, new MeshLambertMaterial(), MAX_PEAKS)
  peaks.instanceMatrix.setUsage(DynamicDrawUsage)
  peaks.count = 0
  peaks.frustumCulled = false
  const ringGeo = new RingGeometry(1.05, 1.4, 28)
  ringGeo.rotateX(-Math.PI / 2)
  const ringMat = new MeshBasicMaterial({ color: colors.ink })
  const rings = new InstancedMesh(ringGeo, ringMat, MAX_PEAKS)
  rings.count = 0
  rings.frustumCulled = false
  scene.add(peaks, rings)

  let projector: Projector | null = null
  let points: PeakPoint[] = []
  let hoverId: string | null = null
  let pickedId: string | null = null
  const m4 = new Matrix4()
  const quat = new Quaternion()
  const tmpColor = new Color()
  const layout = () => {
    if (!projector) return
    let ringCount = 0
    points.forEach((p, i) => {
      const [x, z] = projector!(p.lon, p.lat)
      const hot = p.id === hoverId || p.id === pickedId
      const s = peakSize(p.match, p.greyed)
      const k = hot ? 1.3 : 1
      m4.compose(new Vector3(x, 0.02, z), quat, new Vector3(s.r * k, s.h * (hot ? 1.15 : 1), s.r * k))
      peaks.setMatrixAt(i, m4)
      peaks.setColorAt(i, tmpColor.set(hot ? colors.ink : p.greyed ? colors.off : colors.diff[p.difficulty]))
      if (p.featured) {
        m4.compose(new Vector3(x, 0.06, z), quat, new Vector3(s.r * k * 1.5, 1, s.r * k * 1.5))
        rings.setMatrixAt(ringCount++, m4)
      }
    })
    peaks.count = points.length
    rings.count = ringCount
    peaks.instanceMatrix.needsUpdate = true
    if (peaks.instanceColor) peaks.instanceColor.needsUpdate = true
    rings.instanceMatrix.needsUpdate = true
    peaks.computeBoundingSphere() // the raycaster uses it
    requestRender()
  }
  const setColors: SceneHandle['setColors'] = (c) => {
    colors = c
    stateMat.color.set(c.land)
    lineMat.color.set(c.border)
    ringMat.color.set(c.ink)
    layout() // re-sets every instance colour and requests one render
  }
  const setPeaks: SceneHandle['setPeaks'] = (pts, hover, picked) => {
    points = pts.slice(0, MAX_PEAKS)
    hoverId = hover
    pickedId = picked
    layout()
  }

  // ---- picking and pointer ----
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const pickAt: SceneHandle['pickAt'] = (cx, cy) => {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height || !points.length) return null
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1))
    camera.updateMatrixWorld()
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObject(peaks, false)[0]
    return hit?.instanceId !== undefined ? points[hit.instanceId]?.id ?? null : null
  }
  const callbacks: SceneCallbacks = { onHover: () => {}, onSelect: () => {} }
  let lastHover: string | null = null
  let moveRaf = 0
  let down: { x: number; y: number } | null = null
  const onMove = (e: PointerEvent) => {
    if (e.buttons) return // dragging the camera
    const { clientX, clientY } = e
    if (moveRaf) return
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0
      const id = pickAt(clientX, clientY)
      canvas.style.cursor = id ? 'pointer' : 'grab'
      if (id !== lastHover) { lastHover = id; callbacks.onHover(id) }
    })
  }
  const onLeave = () => { if (lastHover !== null) { lastHover = null; callbacks.onHover(null) } }
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 5) return // it was an orbit or pan, not a click
    const id = pickAt(e.clientX, e.clientY)
    if (id) callbacks.onSelect(id)
  }
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)

  const setSize = (w: number, h: number) => {
    if (w < 1 || h < 1) return
    size = { w, h }
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (!userMoved) fitCamera()
    requestRender()
  }
  const resetView = () => { userMoved = false; fitCamera(); requestRender() }

  const dispose = () => {
    disposed = true
    cancelAnimationFrame(raf)
    cancelAnimationFrame(moveRaf)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerleave', onLeave)
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointerup', onUp)
    controls.dispose()
    scene.traverse((o) => {
      const m = o as Mesh
      m.geometry?.dispose()
      const mat = m.material as Material | Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    peaks.dispose()
    rings.dispose()
    stateMat.dispose()
    lineMat.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }

  fitCamera()
  return { canvas, callbacks, setStates, setColors, setPeaks, setSize, resetView, pickAt, peakCount: () => points.length, dispose }
}
