import { ExternalLink, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { modelOf, PS5_STORES, sortOffers, type Ps5Feed, type Ps5Model, type Ps5Offer } from '../../../shared/ps5.ts'
import { ago, money } from '../lib/format.ts'
import { safeLink } from '../lib/link.ts'
import { daysToBlackFriday } from '../lib/retailers.ts'

/**
 * TEMPORARY (Black Friday 2026): every PS5 console listing from the SA stores we read, cheapest first.
 * Delete this file, its tab in BottomNav/App, shared/ps5.ts, scraper/src/ps5/ and .github/workflows/ps5.yml afterwards.
 */

type Model = 'all' | Ps5Model

const MODELS: { id: Model; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'digital', label: 'Digital' },
  { id: 'disc', label: 'Disc' },
  { id: 'pro', label: 'Pro' },
]

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; feed: Ps5Feed }

function usePs5Feed() {
  const [state, setState] = useState<Load>({ status: 'loading' })
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/ps5.json`)
      if (!r.ok) throw new Error(r.status === 404 ? 'No PS5 prices yet: the first run has not finished.' : `Could not load (${r.status})`)
      const feed = (await r.json()) as Ps5Feed
      setState((cur) => (cur.status === 'ready' && cur.feed.generatedAt === feed.generatedAt ? cur : { status: 'ready', feed }))
    } catch (e) {
      setState((cur) => (cur.status === 'ready' ? cur : { status: 'error', message: (e as Error).message }))
    }
  }, [])
  useEffect(() => {
    void refresh()
    // The service worker answers from its saved copy first; asking again shortly after picks up newer data.
    const timer = setTimeout(() => void refresh(), 4000)
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])
  return state
}

export function Ps5Deals() {
  const state = usePs5Feed()
  const [model, setModel] = useState<Model>('all')
  const [showOutOfStock, setShowOutOfStock] = useState(false)
  const days = daysToBlackFriday()

  const offers = useMemo(() => {
    if (state.status !== 'ready') return []
    return sortOffers(state.feed.offers).filter(
      (o) => (showOutOfStock || o.inStock !== false) && (model === 'all' || modelOf(o.name) === model),
    )
  }, [state, model, showOutOfStock])

  if (state.status === 'loading') return <p className="py-16 text-center text-muted">Loading PS5 prices…</p>
  if (state.status === 'error') return <p className="rounded-2xl border border-line bg-surface p-6 text-center">{state.message}</p>

  const { feed } = state
  const hiddenOutOfStock = feed.offers.filter((o) => o.inStock === false).length

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-2xl bg-gradient-to-r from-[#0b3b8c] to-[#1f6feb] p-4 text-white">
        <h2 className="text-xl font-extrabold">PS5 console prices</h2>
        <p className="mt-1 text-sm opacity-90">
          {days > 0 ? `Black Friday is in ${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'It’s Black Friday' : 'Black Friday has passed'}
          {' · '}
          {Object.keys(PS5_STORES).length} stores, checked every hour · updated {ago(feed.generatedAt)}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label="Model">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              aria-pressed={model === m.id}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${model === m.id ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showOutOfStock} onChange={(e) => setShowOutOfStock(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Show out of stock ({hiddenOutOfStock})
        </label>
      </div>

      {offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">No consoles match.</p>
      ) : (
        <ol className="space-y-2">
          {offers.map((o, i) => (
            <OfferRow key={`${o.store}:${o.url}`} offer={o} rank={i + 1} />
          ))}
        </ol>
      )}

      <p className="text-xs text-muted">
        Prices are read from each store’s website and can lag the store by up to an hour. Takealot, Amazon and Makro include
        marketplace sellers. Always check the price on the store’s page before buying.
      </p>

      <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Stores checked</summary>
        <ul className="mt-3 space-y-1.5">
          {feed.runs.map((r) => (
            <li key={r.store} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.ok ? 'bg-ok' : 'bg-brand'}`} />
                {PS5_STORES[r.store]}
              </span>
              <span className="text-right text-muted">
                {r.count} {r.count === 1 ? 'console' : 'consoles'}
                {r.at ? ` · ${ago(r.at)}` : ''}
                {!r.ok && ' · latest check failed'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function OfferRow({ offer: o, rank }: { offer: Ps5Offer; rank: number }) {
  const link = safeLink(o.url)
  const savePct = o.wasPrice ? Math.round((1 - o.price / o.wasPrice) * 100) : 0
  const best = rank === 1
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border bg-surface p-3 shadow-sm ${best ? 'border-ok' : 'border-line'} ${o.inStock === false ? 'opacity-60' : ''}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${best ? 'bg-ok text-white' : 'bg-bg text-muted'}`}>
        {best ? <Trophy aria-label="Cheapest" size={16} /> : rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {PS5_STORES[o.store]}
          {o.inStock === false && <span className="ml-2 normal-case text-brand">Out of stock</span>}
          {/parallel import/i.test(o.name) && <span className="ml-2 normal-case text-info">Parallel import</span>}
        </p>
        <p className="line-clamp-2 text-[15px] font-medium leading-snug">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {o.name}
              <ExternalLink aria-label={`(opens ${PS5_STORES[o.store]})`} size={13} className="ml-1 inline align-[-1px] text-muted" />
            </a>
          ) : (
            o.name
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-extrabold tabular-nums">{money(o.price)}</p>
        {o.wasPrice && (
          <p className="text-xs text-muted">
            <s className="tabular-nums">{money(o.wasPrice)}</s> <span className="font-semibold text-ok">-{savePct}%</span>
          </p>
        )}
      </div>
    </li>
  )
}
