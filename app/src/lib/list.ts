import { useCallback, useEffect, useRef, useState } from 'react'
import type { DealProduct } from '../../../shared/types.ts'
import { dealKey } from './query.ts'
import { deleteItem, fetchList, newHouseholdCode, putItem, syncConfig } from './sync.ts'

const ITEMS_KEY = 'sharp-deals:list'
const HOUSEHOLD_KEY = 'sharp-deals:household'
const POLL_MS = 8000

export type SyncStatus = 'unconfigured' | 'off' | 'syncing' | 'ok' | 'error'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the value simply will not persist.
  }
}

/**
 * The shopping list. Always kept on this device; when a household code is set (and Supabase is
 * configured) it is also shared, so everyone with the code sees the same list within seconds.
 * Each item stores a snapshot of the deal, so it still reads correctly after the deal expires.
 */
export function useShoppingList() {
  const cfg = syncConfig()
  const [items, setItems] = useState<DealProduct[]>(() => read(ITEMS_KEY, []))
  const [household, setHousehold] = useState<string | null>(() => read<string | null>(HOUSEHOLD_KEY, null))
  const [status, setStatus] = useState<SyncStatus>(cfg ? 'off' : 'unconfigured')
  // Changes made on this phone that have not reached the server yet.
  const pending = useRef<(() => Promise<void>)[]>([])
  const busy = useRef(false)

  useEffect(() => write(ITEMS_KEY, items), [items])
  useEffect(() => write(HOUSEHOLD_KEY, household), [household])

  /** Sends queued changes in order; stops at the first failure and keeps the rest for next time. */
  const flush = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      while (pending.current.length) {
        await pending.current[0]()
        pending.current.shift()
      }
    } finally {
      busy.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!cfg || !household) return
    try {
      await flush()
      if (pending.current.length) return
      const remote = await fetchList(cfg, household)
      setItems(remote)
      setStatus('ok')
    } catch {
      setStatus('error')
    }
    // cfg is derived from build-time env and never changes while the app runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, flush])

  useEffect(() => {
    if (!cfg || !household) {
      setStatus(cfg ? 'off' : 'unconfigured')
      return
    }
    setStatus('syncing')
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, refresh])

  const queue = useCallback(
    (job: () => Promise<void>) => {
      if (!cfg || !household) return
      pending.current.push(job)
      void flush().catch(() => setStatus('error'))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [household, flush],
  )

  const has = useCallback((p: DealProduct) => items.some((i) => dealKey(i) === dealKey(p)), [items])

  const toggle = useCallback(
    (p: DealProduct) => {
      const present = items.some((i) => dealKey(i) === dealKey(p))
      setItems(present ? items.filter((i) => dealKey(i) !== dealKey(p)) : [p, ...items])
      if (cfg && household) queue(() => (present ? deleteItem(cfg, household, p) : putItem(cfg, household, p)))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, household, queue],
  )

  const clear = useCallback(() => {
    if (cfg && household) for (const p of items) queue(() => deleteItem(cfg, household, p))
    setItems([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, household, queue])

  /** Start sharing under a code: this phone's current items are added to the shared list first. */
  const join = useCallback(
    (code: string) => {
      if (!cfg) return
      pending.current = items.map((p) => () => putItem(cfg, code, p))
      setHousehold(code)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  )

  const startSharing = useCallback(() => join(newHouseholdCode()), [join])
  const leave = useCallback(() => {
    pending.current = []
    setHousehold(null)
  }, [])

  return { items, has, toggle, clear, household, status, canShare: !!cfg, join, startSharing, leave }
}
