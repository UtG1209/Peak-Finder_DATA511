// Provider for the linked month + checkpoint selection (see selectionContext.ts).
import { useMemo, useState, type ReactNode } from 'react'
import { useFilters } from '../../lib/useFilters'
import { SelectionCtx } from './selectionContext'

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [filters] = useFilters()
  const [picked, setPicked] = useState<{ q: number; month: number | null }>({ q: filters.q, month: null })
  const [checkpoint, setCheckpoint] = useState<number | null>(null)
  // a month picked in another quarter means nothing in this one: it simply reads as "none"
  const month = picked.q === filters.q ? picked.month : null
  const value = useMemo(
    () => ({ month, setMonth: (m: number | null) => setPicked({ q: filters.q, month: m }), checkpoint, setCheckpoint }),
    [month, checkpoint, filters.q],
  )
  return <SelectionCtx.Provider value={value}>{children}</SelectionCtx.Provider>
}
