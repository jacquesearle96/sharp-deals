import { useMemo, useState } from 'react'
import type { DealProduct, StoreId } from '../../shared/types.ts'
import { BottomNav, type Tab } from './components/BottomNav.tsx'
import { DealCard } from './components/DealCard.tsx'
import { DealList } from './components/DealList.tsx'
import { FilterBar } from './components/FilterBar.tsx'
import { ShareList } from './components/ShareList.tsx'
import { ShopAround } from './components/ShopAround.tsx'
import { useDeals, useShopIndex } from './lib/data.ts'
import { ago, money } from './lib/format.ts'
import { useShoppingList } from './lib/list.ts'
import { queryDeals, type Filters } from './lib/query.ts'
import { STORE_INFO } from './lib/stores.ts'

const SEARCH_DEFAULTS: Filters = { text: '', stores: [], multiBuyOnly: false, sort: 'relevance' }
const TOP_DEFAULTS: Filters = { text: '', stores: [], multiBuyOnly: true, sort: 'saving' }

export default function App() {
  const { state, mini } = useDeals()
  const list = useShoppingList()
  const [tab, setTab] = useState<Tab>('search')
  // The big Baby and Tech catalogue only loads once someone opens that tab.
  const shop = useShopIndex(tab === 'shop')
  const [search, setSearch] = useState<Filters>(SEARCH_DEFAULTS)
  const [top, setTop] = useState<Filters>(TOP_DEFAULTS)

  const products = state.status === 'ready' ? state.index.products : []
  const counts = useMemo(() => {
    const c: Partial<Record<StoreId, number>> = {}
    for (const p of products) c[p.store] = (c[p.store] ?? 0) + 1
    return c
  }, [products])

  const searchResults = useMemo(() => (mini ? queryDeals(products, mini, search) : []), [products, mini, search])
  const topResults = useMemo(() => (mini ? queryDeals(products, mini, top) : []), [products, mini, top])

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-28">
      <header className="safe-top sticky top-0 z-10 bg-bg/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-black tracking-tight">
            Sharp <span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">Deals</span>
          </h1>
          {state.status === 'ready' && (
            <p className="text-xs text-muted">Updated {ago(state.index.generatedAt)}</p>
          )}
        </div>
      </header>

      <main className="space-y-4 px-4">
        {state.status === 'loading' && <p className="py-16 text-center text-muted">Loading deals…</p>}
        {state.status === 'error' && (
          <p className="rounded-2xl border border-line bg-surface p-6 text-center">
            Couldn’t load deals. {state.message}
          </p>
        )}

        {state.status === 'ready' && tab === 'search' && (
          <>
            <FilterBar filters={search} onChange={setSearch} counts={counts} />
            <DealList
              deals={searchResults}
              has={list.has}
              onToggle={list.toggle}
              empty={search.text ? `No deals found for “${search.text}”.` : 'No deals match these filters.'}
            />
          </>
        )}

        {state.status === 'ready' && tab === 'deals' && (
          <>
            <p className="text-sm text-muted">The best multi-buy deals right now, biggest saving first.</p>
            <FilterBar filters={top} onChange={setTop} counts={counts} hideSearch />
            <DealList deals={topResults} has={list.has} onToggle={list.toggle} empty="No multi-buy deals match these filters." />
          </>
        )}

        {tab === 'shop' && <ShopAround shop={shop.state} has={list.has} onToggle={list.toggle} />}

        {state.status === 'ready' && tab === 'list' && <ListScreen list={list} />}

        {state.status === 'ready' && tab !== 'shop' && <StoreStatus runs={state.index.runs} />}
      </main>

      <BottomNav tab={tab} onChange={setTab} listCount={list.items.length} />
    </div>
  )
}

function ListScreen({ list }: { list: ReturnType<typeof useShoppingList> }) {
  const total = list.items.reduce((sum, d) => sum + d.effectivePrice, 0)
  const byStore = new Map<StoreId, DealProduct[]>()
  for (const d of list.items) byStore.set(d.store, [...(byStore.get(d.store) ?? []), d])

  const share = (
    <ShareList
      household={list.household}
      status={list.status}
      canShare={list.canShare}
      onStart={list.startSharing}
      onJoin={list.join}
      onLeave={list.leave}
    />
  )

  if (list.items.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Your list is empty. Tap <b>+</b> on any deal to add it.
        </p>
        {share}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand to-brand2 p-4 text-white">
        <div>
          <p className="text-sm opacity-90">{list.items.length} items</p>
          <p className="text-2xl font-extrabold">{money(total)}</p>
        </div>
        <button type="button" onClick={list.clear} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
          Clear
        </button>
      </div>
      {share}
      {[...byStore.entries()].map(([store, items]) => (
        <section key={store} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{STORE_INFO[store].name}</h2>
          {items.map((d) => (
            <DealCard key={`${d.store}:${d.id}`} deal={d} inList onToggle={list.toggle} />
          ))}
        </section>
      ))}
    </div>
  )
}

/** Shows which stores refreshed, so a failed scrape is visible rather than silent. */
function StoreStatus({ runs }: { runs: { store: StoreId; ok: boolean; at: string; count: number; error?: string }[] }) {
  return (
    <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Data status</summary>
      <ul className="mt-3 space-y-1.5">
        {runs.map((r) => (
          <li key={r.store} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${r.ok && !r.error ? 'bg-ok' : 'bg-brand'}`} />
              {STORE_INFO[r.store].name}
            </span>
            <span className="text-muted">
              {r.ok ? `${r.count.toLocaleString('en-ZA')} items · ${ago(r.at)}` : 'last run failed'}
              {r.ok && r.error ? ' · latest run failed' : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
