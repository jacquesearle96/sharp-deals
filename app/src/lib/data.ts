import { useEffect, useMemo, useState } from 'react'
import type { DealIndex } from '../../../shared/types.ts'
import { buildSearch } from './query.ts'

export type IndexState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; index: DealIndex }

/**
 * Loads one deal index file. The service worker serves a cached copy while offline.
 * Pass enabled=false to hold off until the data is actually needed.
 */
export function useIndex(file: string, enabled = true) {
  const [state, setState] = useState<IndexState>({ status: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${file} (${r.status})`)
        return r.json() as Promise<DealIndex>
      })
      .then((index) => !cancelled && setState({ status: 'ready', index }))
      .catch((e: Error) => !cancelled && setState({ status: 'error', message: e.message }))
    return () => {
      cancelled = true
    }
  }, [file, enabled])

  const mini = useMemo(() => (state.status === 'ready' ? buildSearch(state.index.products) : null), [state])
  return { state, mini }
}

/** The grocery and baby-shop specials behind the main tabs. */
export const useDeals = () => useIndex('index.json')

/** The full Baby and Tech catalogue behind "Shop around". Loaded the first time that tab opens. */
export const useShopIndex = (enabled: boolean) => useIndex('shop-index.json', enabled)
