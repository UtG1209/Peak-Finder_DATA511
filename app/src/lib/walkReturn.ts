// Back from a 3D walk reloads the app, so the hike page remembers its scroll position for a short while (sessionStorage; the walk files are untouched).
const KEY = 'pf-walk-return'
const MAX_AGE_MS = 2 * 60 * 60 * 1000
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const saveWalkReturn = (store: Store, hikeId: string, scrollY: number, now = Date.now()) => {
  try { store.setItem(KEY, JSON.stringify({ hikeId, scrollY, at: now })) } catch { /* private mode: no restore, nothing else breaks */ }
}

/** The scroll position saved for this hike, once: null if none, for another hike, or older than two hours. */
export const takeWalkReturn = (store: Store, hikeId: string, now = Date.now()): number | null => {
  try {
    const raw = store.getItem(KEY)
    if (!raw) return null
    store.removeItem(KEY)
    const r = JSON.parse(raw) as { hikeId?: string; scrollY?: number; at?: number }
    return r.hikeId === hikeId && typeof r.scrollY === 'number' && typeof r.at === 'number' && now - r.at < MAX_AGE_MS ? r.scrollY : null
  } catch { return null }
}
