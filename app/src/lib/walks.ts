import type { Hike } from '../data/schema'

/**
 * Where the 3D walks are served from. By default the same site (`<base>walks/<id>/`), because the walks are copied into the build.
 * If the walks outgrow GitHub Pages (1 GB limit) host them elsewhere and set VITE_WALKS_BASE in the deploy workflow.
 * Nothing in the app loads a walk until the user opens one: this only builds the link.
 */
const WALKS_BASE: string = (import.meta.env.VITE_WALKS_BASE as string | undefined) ?? import.meta.env.BASE_URL

export interface WalkTimeMarker {
  dist_m: number
  dir: 'up' | 'down'
  /** Local clock time in minutes after midnight, as returned by models/checkpoints.timeline. */
  time: number
}

export interface WalkUrlOptions {
  /** In-app hash route to restore when the walk closes. Defaults to the current route or hike route. */
  back?: string
  backname?: string
  times?: WalkTimeMarker[]
}

/** Build a walk URL with its selected season, return route, hike label and optional checkpoint times. */
export const walkUrl = (
  hike: Pick<Hike, 'walk_path'> & Partial<Pick<Hike, 'id' | 'name'>>,
  season: string,
  options: WalkUrlOptions | string = {},
): string | null => {
  if (!hike.walk_path) return null
  const opts = typeof options === 'string' ? { back: options } : options
  const currentHash = typeof window === 'undefined' ? '' : window.location.hash
  const params = new URLSearchParams({ season })
  const back = opts.back || (currentHash.startsWith('#/') ? currentHash : hike.id ? `#/hike/${hike.id}` : '')
  if (back) params.set('back', back)
  const backname = opts.backname ?? hike.name
  if (backname) params.set('backname', backname)
  if (opts.times?.length) params.set('times', JSON.stringify(opts.times))
  return `${WALKS_BASE}${hike.walk_path}index.html?${params.toString()}`
}

export const walkAssetUrl = (hike: Pick<Hike, 'walk_path'>, asset: string): string | null =>
  hike.walk_path ? `${WALKS_BASE}${hike.walk_path}${asset.replace(/^\//, '')}` : null
