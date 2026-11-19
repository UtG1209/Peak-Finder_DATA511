import { useCallback, useEffect, useMemo, useState } from 'react'
import { indexDataset, loadDataset, type DataIndex, type Dataset } from './loaders'

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; data: Dataset; index: DataIndex }

/** Loads all small data files once. Screens read the result; "data failed to load" is handled by the shell. */
export function useDataset(): DatasetState {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ data?: Dataset; error?: string }>({})
  const retry = useCallback(() => {
    setState({})
    setAttempt((a) => a + 1)
  }, [])

  useEffect(() => {
    let live = true
    loadDataset().then(
      (data) => live && setState({ data }),
      (e: unknown) => live && setState({ error: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      live = false
    }
  }, [attempt])

  const index = useMemo(() => (state.data ? indexDataset(state.data) : null), [state.data])
  if (state.error) return { status: 'error', message: state.error, retry }
  if (state.data && index) return { status: 'ready', data: state.data, index }
  return { status: 'loading' }
}
