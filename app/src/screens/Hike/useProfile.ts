// The hike's profile for the hero route glyph and the selection bar's checkpoint. One fetch per hike, shared (module cache).
import { useEffect, useState } from 'react'
import { loadProfile } from '../../data/loaders'
import type { Profile } from '../../data/schema'

const cache = new Map<string, Promise<Profile>>()

/** The profile, or null while loading or when it failed (callers then simply leave the extra out; TrailSection shows the error). */
export function useProfile(hikeId: string): Profile | null {
  const [got, setGot] = useState<{ id: string; profile: Profile } | null>(null)
  useEffect(() => {
    let live = true
    if (!cache.has(hikeId)) cache.set(hikeId, loadProfile(hikeId).catch((e: unknown) => { cache.delete(hikeId); throw e }))
    cache.get(hikeId)!.then((profile) => live && setGot({ id: hikeId, profile }), () => {})
    return () => { live = false }
  }, [hikeId])
  return got && got.id === hikeId ? got.profile : null
}
