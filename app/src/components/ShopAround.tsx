import { ArrowUpRight, Baby, Gamepad2, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SHOP_STORES, type DealProduct, type StoreId } from '../../../shared/types.ts'
import type { IndexState } from '../lib/data.ts'
import { buildSearch, queryDeals, type Filters } from '../lib/query.ts'
import { daysToBlackFriday, IDEAS, retailersFor, type ShopCategory } from '../lib/retailers.ts'
import { DealList } from './DealList.tsx'
import { FilterBar, SearchField } from './FilterBar.tsx'
import { Card, cx, Empty, Segmented } from './ui.tsx'

const RECENT_KEY = 'sharp-deals:recent-shop-searches'

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

const CATEGORIES: { id: ShopCategory; label: string; icon: LucideIcon }[] = [
  { id: 'tech', label: 'Tech', icon: Gamepad2 },
  { id: 'baby', label: 'Baby', icon: Baby },
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
      <p className="text-sm text-muted">
        {days > 0 ? `Black Friday in ${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'It’s Black Friday' : 'Sale season is on'}
        {' · '}Search once, then open the same search in every shop.
      </p>

      <Segmented
        label="Section"
        options={CATEGORIES.map((c) => ({ id: c.id, label: <><c.icon aria-hidden size={14} />{c.label}</> }))}
        value={category}
        onChange={(id) => {
          setCategory(id)
          setStores([])
        }}
        className="lg:max-w-xs"
      />

      <SearchField
        value={text}
        onChange={setText}
        placeholder={category === 'tech' ? 'Search PS5, TV, laptop…' : 'Search baby monitor, pram…'}
      />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {[...recent, ...IDEAS[category].filter((i) => !recent.includes(i))].map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setText(idea)}
            className={cx(
              'h-8 shrink-0 rounded-full px-3 text-[13px] transition',
              idea === query ? 'bg-ink text-bg' : 'bg-surface-2 text-ink hover:bg-line',
            )}
          >
            {idea}
          </button>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-medium tracking-wide text-muted uppercase">
          {query ? `Search “${query}” in` : 'Open a search in'}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                className={cx('block transition active:scale-[0.98]', disabled && 'pointer-events-none opacity-45')}
              >
                <Card className="flex h-full items-start justify-between gap-2 p-3 hover:bg-surface-2/50">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    {r.note && <span className="mt-0.5 block text-xs text-muted">{r.note}</span>}
                  </span>
                  <ArrowUpRight aria-hidden size={16} className="shrink-0 text-faint" />
                </Card>
              </a>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-[13px] font-medium tracking-wide text-muted uppercase">Prices we track</h2>
        {shop.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}
        {shop.status === 'error' && (
          <Empty title="No tracked prices yet">Black Friday prices will appear here as the shops publish them.</Empty>
        )}
        {shop.status === 'ready' && products.length === 0 && (
          <Empty title={`We don’t track any ${category} shops yet`}>Use the shops above to search them directly.</Empty>
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
