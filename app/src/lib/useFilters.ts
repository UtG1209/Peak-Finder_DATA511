import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseFilters, serializeFilters, type FilterState } from './filters'

/** Read and write the Explore filters through the URL (so Back and Share links just work). */
export function useFilters(): [FilterState, (patch: Partial<FilterState>) => void, () => void] {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const update = useCallback(
    (patch: Partial<FilterState>) => setParams(serializeFilters({ ...filters, ...patch }), { replace: true }), // replace: one slider drag must not add 30 history entries
    [filters, setParams],
  )
  // "Reset filters" keeps the home city and quarter, clears the limits.
  const reset = useCallback(
    () => setParams(serializeFilters({ ...filters, temp: null, crowd: null, smoke: null, rain: null, travel: null, diff: [], has3d: false })),
    [filters, setParams],
  )
  return [filters, update, reset]
}
