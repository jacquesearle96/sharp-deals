import { useCallback, useEffect, useState } from 'react'
import type { Ps5Feed } from '../../../shared/ps5.ts'

/** TEMPORARY (Black Friday 2026): loads ps5.json, used by the PS5 tab and by the store list in Settings. */

export type Ps5Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; feed: Ps5Feed }

export function usePs5Feed(enabled = true) {
  const [state, setState] = useState<Ps5Load>({ status: 'loading' })
  /** Loads ps5.json from the network (the service worker leaves this file alone) and returns its generatedAt. */
  const reload = useCallback(async (): Promise<string | undefined> => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/ps5.json`, { cache: 'no-store' })
      if (!r.ok) throw new Error(r.status === 404 ? 'No PS5 prices yet: the first run has not finished.' : `Could not load (${r.status})`)
      const feed = (await r.json()) as Ps5Feed
      setState((cur) => (cur.status === 'ready' && cur.feed.generatedAt === feed.generatedAt ? cur : { status: 'ready', feed }))
      return feed.generatedAt
    } catch (e) {
      setState((cur) => (cur.status === 'ready' ? cur : { status: 'error', message: (e as Error).message }))
      return undefined
    }
  }, [])
  useEffect(() => {
    if (!enabled) return
    void reload()
    const onVisible = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload, enabled])
  return { state, reload }
}
