import { useEffect, useMemo, useState } from 'react'
import { SHOP_STORES, type DealProduct, type StoreId } from '../../../shared/types.ts'
import type { IndexState } from '../lib/data.ts'
import { buildSearch, queryDeals, type Filters } from '../lib/query.ts'
import { daysToBlackFriday, IDEAS, retailersFor, type ShopCategory } from '../lib/retailers.ts'
import { DealList } from './DealList.tsx'
import { FilterBar } from './FilterBar.tsx'

const RECENT_KEY = 'sharp-deals:recent-shop-searches'

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

const CATEGORIES: { id: ShopCategory; label: string; icon: string }[] = [
  { id: 'tech', label: 'Tech', icon: '🎮' },
  { id: 'baby', label: 'Baby', icon: '🍼' },
]

interface Props {
  shop: IndexState
  has: (deal: DealProduct) => boolean
  onToggle: (deal: DealProduct) => void
}

export function ShopAround({ shop, has, onToggle }: Props) {
  const [category, setCategory] = useState<ShopCategory>('baby')
  const [text, setText] = useState('')
  const [stores, setStores] = useState<StoreId[]>([])
  const [onSaleOnly, setOnSaleOnly] = useState(false)
  const [sort, setSort] = useState<Filters['sort']>('relevance')
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const query = text.trim()
  const days = daysToBlackFriday()

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    } catch {
      // Storage unavailable: recent searches just will not persist.
    }
  }, [recent])

  const remember = () => {
    if (query) setRecent((cur) => [query, ...cur.filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(0, 8))
  }

  // Scraped catalogue for the chosen section only.
  const products = useMemo(
    () => (shop.status === 'ready' ? shop.index.products.filter((p) => p.category === category) : []),
    [shop, category],
  )
  const mini = useMemo(() => buildSearch(products), [products])
  const counts = useMemo(() => {
    const c: Partial<Record<StoreId, number>> = {}
    for (const p of products) c[p.store] = (c[p.store] ?? 0) + 1
    return c
  }, [products])
  const shopsWithData = SHOP_STORES.filter((s) => (counts[s] ?? 0) > 0)
  const results = useMemo(
    () => queryDeals(products, mini, { text, stores, multiBuyOnly: false, onSaleOnly, sort }),
    [products, mini, text, stores, onSaleOnly, sort],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-brand to-brand2 p-4 text-white">
        <p className="text-sm font-semibold opacity-90">Black Friday · 27 Nov</p>
        <p className="text-2xl font-extrabold">
          {days > 0 ? `${days} days to go` : days === 0 ? 'It’s today!' : 'Sale season is on'}
        </p>
        <p className="mt-1 text-sm opacity-90">Search once, then open the same search in every shop.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategory(c.id)
              setStores([])
            }}
            aria-pressed={category === c.id}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              category === c.id ? 'bg-ink text-bg' : 'text-muted'
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm focus-within:border-brand">
        <span aria-hidden>🔍</span>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={category === 'tech' ? 'Search PS5, TV, laptop…' : 'Search baby monitor, pram…'}
          enterKeyHint="search"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted"
        />
      </label>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {[...recent, ...IDEAS[category].filter((i) => !recent.includes(i))].map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setText(idea)}
            className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
          >
            {idea}
          </button>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          {query ? `Search “${query}” in` : 'Pick a search above, then open it in'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {retailersFor(category).map((r) => {
            const disabled = !query
            return (
              <a
                key={r.id}
                href={disabled ? undefined : r.searchUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={remember}
                aria-disabled={disabled}
                className={`flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3 shadow-sm transition active:scale-[0.98] ${
                  disabled ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                  {r.name}
                </span>
                <span className="text-xs text-muted">{r.note ?? 'Open search ↗'}</span>
              </a>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Prices we track</h2>
        {shop.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}
        {shop.status === 'error' && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            No tracked prices yet. Black Friday prices will appear here as the shops publish them.
          </p>
        )}
        {shop.status === 'ready' && products.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            We don’t track any {category} shops yet. Use the buttons above to search them directly.
          </p>
        )}
        {shop.status === 'ready' && products.length > 0 && (
          <>
            <FilterBar
              filters={{ text, stores, multiBuyOnly: false, onSaleOnly, sort }}
              onChange={(f) => {
                setStores(f.stores)
                setOnSaleOnly(!!f.onSaleOnly)
                setSort(f.sort)
              }}
              counts={counts}
              stores={shopsWithData}
              hideSearch
              showOnSale
            />
            <DealList
              deals={results}
              has={has}
              onToggle={onToggle}
              empty={query ? `No tracked prices match “${query}”. Try the shop buttons above.` : 'Nothing matches these filters.'}
            />
          </>
        )}
      </section>
    </div>
  )
}
