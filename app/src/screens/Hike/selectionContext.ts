// The one linked selection of the Hike page (Plan 5b): month and checkpoint, shared by every block.
// The quarter is NOT here: it stays in the URL (`q`, via useFilters). Choosing a new quarter clears the month.
import { createContext, useContext } from 'react'

export interface Selection {
  /** 1..12, or null = no single month picked (the whole quarter is in focus). */
  month: number | null
  setMonth: (m: number | null) => void
  /** Index into the hike's checkpoints (0 = trailhead), or null = none picked. */
  checkpoint: number | null
  setCheckpoint: (i: number | null) => void
}

export const SelectionCtx = createContext<Selection | null>(null)

export function useSelection(): Selection {
  const v = useContext(SelectionCtx)
  if (!v) throw new Error('useSelection needs <SelectionProvider>')
  return v
}
