import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DealIndex } from '../../../shared/types.ts'
import { buildSearch } from './query.ts'

export type IndexState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; index: DealIndex }

/**
 * The service worker answers data requests from its saved copy straight away and refreshes that copy in
 * the background. Asking again a few seconds later therefore returns the newer data.
 */
const RECHECK_MS = 4000
const BANNER_MS = 5000

/**
 * Loads one deal index file. It shows the saved copy at once (fast, and works offline), then checks again
 * shortly after opening and whenever the app comes back to the foreground, swapping in newer data if any.
 * Pass enabled=false to hold off until the data is actually needed.
 */
export function useIndex(file: string, enabled = true) {
  const [state, setState] = useState<IndexState>({ status: 'loading' })
  // True for a few seconds after newer data replaced what was on screen.
  const [updated, setUpdated] = useState(false)
  const generation = useRef<string | null>(null)

  const refresh = useCallback(
    async (announce: boolean) => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
        if (!r.ok) throw new Error(`Could not load ${file} (${r.status})`)
        const index = (await r.json()) as DealIndex
        if (index.generatedAt === generation.current) return
        const hadData = generation.current !== null
        generation.current = index.generatedAt
        setState({ status: 'ready', index })
        if (announce && hadData) setUpdated(true)
      } catch (e) {
        // A failed re-check must not replace data that is already showing.
        if (generation.current === null) setState({ status: 'error', message: (e as Error).message })
      }
    },
    [file],
  )

  useEffect(() => {
    if (!enabled) return
    void refresh(false)
    const timer = setTimeout(() => void refresh(true), RECHECK_MS)
    const onVisible = () => document.visibilityState === 'visible' && void refresh(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, refresh])

  useEffect(() => {
    if (!updated) return
    const timer = setTimeout(() => setUpdated(false), BANNER_MS)
    return () => clearTimeout(timer)
  }, [updated])

  const mini = useMemo(() => (state.status === 'ready' ? buildSearch(state.index.products) : null), [state])
  return { state, mini, updated }
}

/** The grocery and baby-shop specials behind the main tabs. */
export const useDeals = () => useIndex('index.json')

/** The full Baby and Tech catalogue behind "Shop around". Loaded the first time that tab opens. */
export const useShopIndex = (enabled: boolean) => useIndex('shop-index.json', enabled)
