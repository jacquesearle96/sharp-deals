import MiniSearch from 'minisearch'
import { isMultiBuy } from '../../../shared/promo.ts'
import type { DealProduct, StoreId } from '../../../shared/types.ts'

export type SortKey = 'relevance' | 'saving' | 'price' | 'ending'

export interface Filters {
  text: string
  stores: StoreId[]
  multiBuyOnly: boolean
  sort: SortKey
}

export const dealKey = (p: Pick<DealProduct, 'store' | 'id'>) => `${p.store}:${p.id}`

export function buildSearch(products: DealProduct[]) {
  const mini = new MiniSearch<DealProduct & { key: string }>({
    idField: 'key',
    fields: ['name', 'brand'],
    searchOptions: { prefix: true, fuzzy: 0.15, combineWith: 'AND', boost: { name: 2 } },
  })
  mini.addAll(products.map((p) => ({ ...p, key: dealKey(p) })))
  return mini
}

const endsAt = (p: DealProduct) => (p.promoEnds ? Date.parse(p.promoEnds) : Infinity)

/** Filters, searches and sorts deals. With no search text, "relevance" means biggest saving first. */
export function queryDeals(products: DealProduct[], mini: MiniSearch, f: Filters): DealProduct[] {
  let rows = products
  const text = f.text.trim()
  const score = new Map<string, number>()
  if (text) {
    for (const hit of mini.search(text)) score.set(hit.id, hit.score)
    rows = rows.filter((p) => score.has(dealKey(p)))
  }
  if (f.stores.length) rows = rows.filter((p) => f.stores.includes(p.store))
  if (f.multiBuyOnly) rows = rows.filter((p) => isMultiBuy(p.promo))

  const cmp: Record<SortKey, (a: DealProduct, b: DealProduct) => number> = {
    relevance: text
      ? (a, b) => (score.get(dealKey(b)) ?? 0) - (score.get(dealKey(a)) ?? 0)
      : (a, b) => b.savePct - a.savePct,
    saving: (a, b) => b.savePct - a.savePct,
    price: (a, b) => a.effectivePrice - b.effectivePrice,
    ending: (a, b) => endsAt(a) - endsAt(b),
  }
  return [...rows].sort(cmp[f.sort])
}
