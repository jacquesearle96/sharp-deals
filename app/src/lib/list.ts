import { useCallback, useEffect, useState } from 'react'
import type { DealProduct } from '../../../shared/types.ts'
import { dealKey } from './query.ts'

const KEY = 'sharp-deals:list'

function load(): DealProduct[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DealProduct[]) : []
  } catch {
    return []
  }
}

/**
 * Shopping list kept on this device. Each item stores a snapshot of the deal so the
 * list still reads correctly after the deal expires. (Sharing between phones comes later.)
 */
export function useShoppingList() {
  const [items, setItems] = useState<DealProduct[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      // Private mode or full storage: the list simply will not persist.
    }
  }, [items])

  const has = useCallback((p: DealProduct) => items.some((i) => dealKey(i) === dealKey(p)), [items])
  const toggle = useCallback(
    (p: DealProduct) =>
      setItems((cur) => (cur.some((i) => dealKey(i) === dealKey(p)) ? cur.filter((i) => dealKey(i) !== dealKey(p)) : [p, ...cur])),
    [],
  )
  const clear = useCallback(() => setItems([]), [])
  return { items, has, toggle, clear }
}
