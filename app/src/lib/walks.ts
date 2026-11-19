import type { Hike } from '../data/schema'

/**
 * Where the 3D walks are served from. By default the same site (`<base>walks/<id>/`), because the walks are copied into the build.
 * If the walks outgrow GitHub Pages (1 GB limit) host them elsewhere and set VITE_WALKS_BASE in the deploy workflow,
 * e.g. VITE_WALKS_BASE=https://utg1209.github.io/peak-finder-walks/  (must end with a slash).
 * Nothing in the app loads a walk until the user opens one: this only builds the link.
 */
const WALKS_BASE: string = (import.meta.env.VITE_WALKS_BASE as string | undefined) ?? import.meta.env.BASE_URL

export const walkUrl = (hike: Pick<Hike, 'walk_path'>, season: string): string | null =>
  hike.walk_path ? `${WALKS_BASE}${hike.walk_path}index.html?season=${season}` : null
