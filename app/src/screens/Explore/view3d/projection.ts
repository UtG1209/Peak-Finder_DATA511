// Pure map projection for the 3D view: lon/lat -> scene x/z (ground plane, y is up).
// d3's Albers conic fitted to the lower 48, centred on the origin, so the whole country spans about +-WIDTH/2 in x.
import { geoAlbers } from 'd3'
import type { FeatureCollection, Geometry } from 'geojson'

/** Scene units across the lower 48 (west to east). */
export const SCENE_WIDTH = 100
const SCENE_HEIGHT = 64

export type Projector = (lon: number, lat: number) => [number, number]

/** Fit Albers to the given states and return a function lon/lat -> [x, z]. East is +x, south is +z (towards a camera in the south). */
export function makeProjector(states: FeatureCollection<Geometry>): Projector {
  const proj = geoAlbers().fitSize([SCENE_WIDTH, SCENE_HEIGHT], states)
  const [tx, ty] = proj.translate()
  proj.translate([tx - SCENE_WIDTH / 2, ty - SCENE_HEIGHT / 2])
  return (lon, lat) => {
    const p = proj([lon, lat])
    return p ? [p[0], p[1]] : [0, 0]
  }
}

/** Drop Alaska (02), Hawaii (15) and territories (> 56): the same lower-48 filter the 2D map uses. */
export function lower48(all: FeatureCollection<Geometry>): FeatureCollection<Geometry> {
  return { ...all, features: all.features.filter((f) => !['02', '15'].includes(String(f.id)) && Number(f.id) <= 56) }
}
