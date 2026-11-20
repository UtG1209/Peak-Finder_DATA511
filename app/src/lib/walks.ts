import type { Hike } from '../data/schema'

/**
 * Where the 3D walks are served from. By default the same site (`<base>walks/<id>/`), because the walks are copied into the build.
 * If the walks outgrow GitHub Pages (1 GB limit) host them elsewhere and set VITE_WALKS_BASE in the deploy workflow,
 * e.g. VITE_WALKS_BASE=https://utg1209.github.io/peak-finder-walks/  (must end with a slash).
 * Nothing in the app loads a walk until the user opens one: this only builds the link.
 */
const WALKS_BASE: string = (import.meta.env.VITE_WALKS_BASE as string | undefined) ?? import.meta.env.BASE_URL

/**
 * Link to a hike's 3D walk. Adds `back` (the in-app hike address, e.g. `#/hike/<id>?q=3&from=SEA`) and `backname`
 * (the hike name) so the walk page can show "Back to <name>" and return to the same page with the same filters.
 * `currentHash` defaults to the browser's current hash; tests pass it in.
 */
export const walkUrl = (
  hike: Pick<Hike, 'walk_path'> & Partial<Pick<Hike, 'id' | 'name'>>,
  season: string,
  currentHash: string = typeof window === 'undefined' ? '' : window.location.hash,
): string | null => {
  if (!hike.walk_path) return null
  let url = `${WALKS_BASE}${hike.walk_path}index.html?season=${season}`
  const back = currentHash.startsWith('#/') ? currentHash : hike.id ? `#/hike/${hike.id}` : ''
  if (back) url += `&back=${encodeURIComponent(back)}`
  if (hike.name) url += `&backname=${encodeURIComponent(hike.name)}`
  return url
}
