import { useEffect, useMemo, useState } from 'react'
import type { DealIndex } from '../../../shared/types.ts'
import { buildSearch } from './query.ts'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; index: DealIndex }

/** Loads the deal index once; the service worker serves a cached copy while offline. */
export function useDeals() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load deals (${r.status})`)
        return r.json() as Promise<DealIndex>
      })
      .then((index) => !cancelled && setState({ status: 'ready', index }))
      .catch((e: Error) => !cancelled && setState({ status: 'error', message: e.message }))
    return () => {
      cancelled = true
    }
  }, [])

  const mini = useMemo(() => (state.status === 'ready' ? buildSearch(state.index.products) : null), [state])
  return { state, mini }
}
