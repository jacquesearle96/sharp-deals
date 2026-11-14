import { ChevronLeft, ShoppingBasket, Sparkles, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DealProduct, StoreId } from '../../shared/types.ts'
import { BottomNav, TABS, TopNav, type Tab } from './components/BottomNav.tsx'
import { DealCard } from './components/DealCard.tsx'
import { DealList } from './components/DealList.tsx'
import { FilterBar } from './components/FilterBar.tsx'
import { Ps5Deals } from './components/Ps5Deals.tsx'
import { Settings, SETTINGS_TITLES, type SettingsPage } from './components/Settings.tsx'
import { ShopAround } from './components/ShopAround.tsx'
import { Button, Card, cx, Empty } from './components/ui.tsx'
import { useDeals, useShopIndex, type Freshness } from './lib/data.ts'
import { ago, money } from './lib/format.ts'
import { useShoppingList } from './lib/list.ts'
import { useHiddenTabs, useTheme } from './lib/prefs.ts'
import { queryDeals, type Filters } from './lib/query.ts'
import { STORE_INFO } from './lib/stores.ts'

const SEARCH_DEFAULTS: Filters = { text: '', stores: [], multiBuyOnly: false, sort: 'relevance' }
const TOP_DEFAULTS: Filters = { text: '', stores: [], multiBuyOnly: true, sort: 'saving' }

/** The deals are scraped every 6 hours; anything older than this means a run was missed or failed. */
const STALE_HOURS = 8

export default function App() {
  const { state, mini, updated, freshness } = useDeals()
  const list = useShoppingList()
  const [theme, setTheme] = useTheme()
  const { hidden, toggle: toggleTab } = useHiddenTabs<Tab>()
  const tabs = useMemo(() => TABS.filter((t) => !hidden.includes(t.id)), [hidden])
  const [chosen, setChosen] = useState<Tab>('search')
  // A tab hidden in Settings cannot stay open; fall back to the first one still shown.
  const tab = tabs.some((t) => t.id === chosen) ? chosen : tabs[0].id
  const info = TABS.find((t) => t.id === tab)!
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main')
  const subPage = tab === 'settings' && settingsPage !== 'main'

  // A Settings sub-page gets its own history entry, so the phone's back gesture returns to Settings.
  const openSettingsPage = useCallback((page: SettingsPage) => {
    history.pushState({ settingsPage: page }, '')
    setSettingsPage(page)
  }, [])
  const closeSettingsPage = () => (history.state?.settingsPage ? history.back() : setSettingsPage('main'))
  useEffect(() => {
    const onPop = () => setSettingsPage((history.state?.settingsPage as SettingsPage | undefined) ?? 'main')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /** Tapping a tab opens it at its top level; tapping Settings again leaves a sub-page. */
  const selectTab = (next: Tab) => {
    if (next === 'settings' && subPage) closeSettingsPage()
    setChosen(next)
  }
  const goToSettings = (page: SettingsPage = 'main') => {
    setChosen('settings')
    if (page !== 'main') openSettingsPage(page)
  }
  // The big Baby and Tech catalogue only loads once someone opens that tab.
  const shop = useShopIndex(tab === 'shop')
  const [search, setSearch] = useState<Filters>(SEARCH_DEFAULTS)
  const [top, setTop] = useState<Filters>(TOP_DEFAULTS)

  // Each tab starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, settingsPage])

  const products = useMemo(() => (state.status === 'ready' ? state.index.products : []), [state])
  const counts = useMemo(() => {
    const c: Partial<Record<StoreId, number>> = {}
    for (const p of products) c[p.store] = (c[p.store] ?? 0) + 1
    return c
  }, [products])

  const searchResults = useMemo(() => (mini ? queryDeals(products, mini, search) : []), [products, mini, search])
  const topResults = useMemo(() => (mini ? queryDeals(products, mini, top) : []), [products, mini, top])
  const needsDeals = tab === 'search' || tab === 'deals' || tab === 'list'

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-28 lg:max-w-7xl lg:pb-16">
      <header className="safe-top sticky top-0 z-10 bg-bg/85 backdrop-blur-xl">
        <div className="hidden items-center justify-between gap-6 px-8 py-4 lg:flex">
          <p className="text-lg font-semibold tracking-tight">
            Sharp Deals<span className="text-brand">.</span>
          </p>
          <TopNav tabs={tabs} tab={tab} onChange={selectTab} listCount={list.items.length} />
        </div>
        {subPage && (
          <button
            type="button"
            onClick={closeSettingsPage}
            className="ml-2 flex h-9 items-center gap-0.5 pr-3 text-[15px] text-brand lg:ml-6"
          >
            <ChevronLeft aria-hidden size={22} />
            Settings
          </button>
        )}
        <div className={cx('flex items-end justify-between gap-4 px-4 pb-3 lg:px-8', subPage ? 'pt-0' : 'pt-3 lg:pt-2')}>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight lg:text-3xl">
            {tab === 'settings' ? SETTINGS_TITLES[settingsPage] : info.title}
          </h1>
          {state.status === 'ready' && (tab === 'search' || tab === 'deals') && (
            <DataAge generatedAt={state.index.generatedAt} freshness={freshness} />
          )}
        </div>
        {updated && (
          <p role="status" className="mx-4 mb-2 flex items-center justify-center gap-1.5 rounded-full bg-ok-soft px-3 py-1.5 text-[13px] font-medium text-ok lg:mx-8">
            <Sparkles aria-hidden size={14} />
            New deals loaded
          </p>
        )}
      </header>

      <main className="space-y-4 px-4 pt-1 lg:space-y-6 lg:px-8">
        {needsDeals && state.status === 'loading' && <p className="py-16 text-center text-muted">Loading deals…</p>}
        {needsDeals && state.status === 'error' && <Empty title="Couldn’t load deals">{state.message}</Empty>}

        {state.status === 'ready' && tab === 'search' && (
          <WithSidebar sidebar={<FilterBar filters={search} onChange={setSearch} counts={counts} />}>
            <DealList
              deals={searchResults}
              has={list.has}
              onToggle={list.toggle}
              empty={search.text ? `No deals found for “${search.text}”` : 'No deals match these filters'}
            />
          </WithSidebar>
        )}

        {state.status === 'ready' && tab === 'deals' && (
          <WithSidebar
            sidebar={
              <>
                <p className="text-sm text-muted">The best multi-buy deals right now, biggest saving first.</p>
                <FilterBar filters={top} onChange={setTop} counts={counts} hideSearch />
              </>
            }
          >
            <DealList deals={topResults} has={list.has} onToggle={list.toggle} empty="No multi-buy deals match these filters" />
          </WithSidebar>
        )}

        {tab === 'shop' && <ShopAround shop={shop.state} has={list.has} onToggle={list.toggle} />}

        {/* TEMPORARY (Black Friday 2026) */}
        {tab === 'ps5' && <Ps5Deals onOpenSettings={() => goToSettings('github')} />}

        {tab === 'list' && <ListScreen list={list} onOpenSettings={() => goToSettings()} />}

        {tab === 'settings' && (
          <Settings
            page={settingsPage}
            onPage={openSettingsPage}
            theme={theme}
            onTheme={setTheme}
            hiddenTabs={hidden}
            onToggleTab={toggleTab}
            list={list}
            deals={state}
          />
        )}
      </main>

      <BottomNav tabs={tabs} tab={tab} onChange={selectTab} listCount={list.items.length} />
    </div>
  )
}

/** How old the deals on screen are, and whether that has been checked against the published site. */
function DataAge({ generatedAt, freshness }: { generatedAt: string; freshness: Freshness }) {
  const hours = (Date.now() - Date.parse(generatedAt)) / 3_600_000
  const stale = hours > STALE_HOURS
  const [dot, text] =
    freshness === 'checking'
      ? ['bg-faint animate-pulse', 'Checking for updates']
      : freshness === 'offline'
        ? ['bg-warn', `Offline · saved ${ago(generatedAt)}`]
        : [stale ? 'bg-warn' : 'bg-ok', `Updated ${ago(generatedAt)}`]
  return (
    <p
      className="flex shrink-0 items-center gap-1.5 pb-1.5 text-[13px] text-muted"
      title={stale && freshness === 'live' ? 'This is the newest published data. A scheduled scrape was probably delayed or failed; see Settings.' : undefined}
    >
      <span aria-hidden className={cx('h-2 w-2 rounded-full', dot)} />
      {text}
    </p>
  )
}

/** On wide screens the filters sit in a sticky column beside the results; on a phone they stack above them. */
function WithSidebar({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <aside className="space-y-4 lg:sticky lg:top-40">{sidebar}</aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function ListScreen({ list, onOpenSettings }: { list: ReturnType<typeof useShoppingList>; onOpenSettings: () => void }) {
  const total = list.items.reduce((sum, d) => sum + d.effectivePrice, 0)
  const byStore = new Map<StoreId, DealProduct[]>()
  for (const d of list.items) byStore.set(d.store, [...(byStore.get(d.store) ?? []), d])

  const shared = list.household && (
    <button type="button" onClick={onOpenSettings} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
      <Users aria-hidden size={14} />
      Shared list · {list.status === 'error' ? 'offline' : list.status === 'ok' ? 'up to date' : 'syncing'}
    </button>
  )

  if (list.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Empty icon={<ShoppingBasket size={22} />} title="Your list is empty">
          Tap + on any deal to add it here.
          {!list.household && list.canShare && (
            <>
              {' '}
              To share a list with your partner, open{' '}
              <button type="button" onClick={onOpenSettings} className="text-info underline-offset-2 hover:underline">
                Settings
              </button>
              .
            </>
          )}
        </Empty>
        {shared && <div className="flex justify-center">{shared}</div>}
      </div>
    )
  }

  const clear = () => {
    if (window.confirm(`Remove all ${list.items.length} items from your list?`)) list.clear()
  }

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8 lg:space-y-0">
      <aside className="lg:sticky lg:top-40 lg:order-2">
        <Card className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[13px] text-muted">
              {list.items.length} {list.items.length === 1 ? 'item' : 'items'} · estimated total
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{money(total)}</p>
            {shared && <div className="mt-2">{shared}</div>}
          </div>
          <Button size="sm" onClick={clear}>
            Clear all
          </Button>
        </Card>
      </aside>
      <div className="space-y-6 lg:order-1">
        {[...byStore.entries()].map(([store, items]) => (
          <section key={store} className="space-y-2">
            <h2 className="flex items-center gap-2 px-1 text-[13px] font-medium tracking-wide text-muted uppercase">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: STORE_INFO[store].color }} />
              {STORE_INFO[store].name}
              <span className="text-faint normal-case">· {items.length}</span>
            </h2>
            <div className="grid items-start gap-3 xl:grid-cols-2">
              {items.map((d) => (
                <DealCard key={`${d.store}:${d.id}`} deal={d} inList onToggle={list.toggle} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
