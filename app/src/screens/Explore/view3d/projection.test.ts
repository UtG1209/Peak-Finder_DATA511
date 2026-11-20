import { describe, expect, it } from 'vitest'
import type { FeatureCollection, Geometry } from 'geojson'
import { lower48, makeProjector, SCENE_WIDTH } from './projection'

const box = (id: string, w: number, s: number, e: number, n: number) => ({
  type: 'Feature' as const,
  id,
  properties: {},
  geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
})
const fc = (...f: ReturnType<typeof box>[]): FeatureCollection<Geometry> => ({ type: 'FeatureCollection', features: f })

describe('3D view projection', () => {
  const states = fc(box('53', -124.7, 45.5, -117, 49), box('12', -87.6, 25, -80, 31), box('06', -124.4, 32.5, -114.1, 42))
  const proj = makeProjector(states)
  it('puts west left of east and north above south', () => {
    const seattle = proj(-122.3, 47.6)
    const miami = proj(-80.2, 25.8)
    expect(seattle[0]).toBeLessThan(miami[0])
    expect(seattle[1]).toBeLessThan(miami[1]) // smaller z = further north
  })
  it('is centred on the origin and spans the scene width', () => {
    const west = proj(-124.7, 40)
    const east = proj(-80, 28)
    expect(west[0]).toBeGreaterThanOrEqual(-SCENE_WIDTH / 2 - 0.5)
    expect(east[0]).toBeLessThanOrEqual(SCENE_WIDTH / 2 + 0.5)
    expect((west[0] + east[0]) / 2).toBeLessThan(10)
  })
  it('is deterministic', () => {
    expect(proj(-110, 40)).toEqual(makeProjector(states)(-110, 40))
  })
  it('lower48 drops Alaska, Hawaii and territories', () => {
    const all = fc(box('02', -170, 55, -140, 70), box('15', -160, 19, -155, 22), box('72', -67, 18, -65, 18.5), box('53', -124, 46, -117, 49))
    expect(lower48(all).features.map((f) => f.id)).toEqual(['53'])
  })
})
