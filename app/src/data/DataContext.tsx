import { createContext, useContext } from 'react'
import type { DataIndex, Dataset } from './loaders'

export interface DataValue {
  data: Dataset
  index: DataIndex
}

export const DataContext = createContext<DataValue | null>(null)

/** Screens call this; the shell guarantees the data is loaded before they render. */
export function useData(): DataValue {
  const v = useContext(DataContext)
  if (!v) throw new Error('useData must be used inside the data shell')
  return v
}
