import { ExternalLink, KeyRound, RefreshCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { modelOf, PS5_STORES, sortOffers, type Ps5Feed, type Ps5Model, type Ps5Offer } from '../../../shared/ps5.ts'
import { ago, money } from '../lib/format.ts'
import { safeLink } from '../lib/link.ts'
import { actionsPage, currentRepo, describeRun, isActive, latestRun, loadToken, newTokenPage, saveToken, startRun, type Run } from '../lib/ps5Refresh.ts'
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
    void reload()
    const onVisible = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])
  return { state, reload }
}

export function Ps5Deals() {
  const { state, reload } = usePs5Feed()
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
  if (state.status === 'error')
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="rounded-2xl border border-line bg-surface p-6 text-center">{state.message}</p>
        <RefreshPanel reload={reload} />
      </div>
    )

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

      <RefreshPanel reload={reload} />

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

const POLL_MS = 20_000
const GIVE_UP_MS = 30 * 60_000
/** How long to wait for the site to serve new prices after the run has finished */
const SETTLE_MS = 4 * 60_000

type Refresh =
  | { phase: 'idle'; note?: string }
  | { phase: 'running'; run?: Run; since: number; before?: string; doneAt?: number }
  | { phase: 'setup' }
  | { phase: 'error'; message: string }

/**
 * Refresh reloads the latest prices at once. With a GitHub token saved on this device it also starts a fresh
 * check of every store (the ps5.yml workflow) and follows it until the new prices are published.
 */
function RefreshPanel({ reload }: { reload: () => Promise<string | undefined> }) {
  const repo = useMemo(() => currentRepo(), [])
  const [token, setToken] = useState(loadToken)
  const [draft, setDraft] = useState('')
  const [refresh, setRefresh] = useState<Refresh>({ phase: 'idle' })
  const running = refresh.phase === 'running'

  // A run that is already going (the hourly one, or one started earlier) is followed too.
  useEffect(() => {
    if (!repo || !token) return
    let cancelled = false
    latestRun(repo, token)
      .then((run) => !cancelled && isActive(run) && setRefresh({ phase: 'running', run, since: Date.now() }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [repo, token])

  // While a run is going: check on it every 20 seconds; once it has finished, load prices until they change.
  useEffect(() => {
    if (refresh.phase !== 'running' || !repo || !token) return
    const timer = setTimeout(async () => {
      try {
        if (Date.now() - refresh.since > GIVE_UP_MS) {
          setRefresh({ phase: 'error', message: 'This is taking longer than usual. Check the run on GitHub.' })
          return
        }
        const run = await latestRun(repo, token)
        if (run?.status === 'completed' && (!refresh.run || run.id === refresh.run.id)) {
          if (run.conclusion !== 'success' && run.conclusion !== 'failure') {
            setRefresh({ phase: 'error', message: describeRun(run) })
            return
          }
          // The site can take a minute or two to serve the newly published file.
          const now = await reload()
          if (now && now !== refresh.before) {
            setRefresh({ phase: 'idle', note: 'Prices updated just now.' })
            return
          }
          const doneAt = refresh.doneAt ?? Date.now()
          if (Date.now() - doneAt > SETTLE_MS) {
            setRefresh({ phase: 'idle', note: 'The check finished, but the published prices have not changed yet. Try Refresh again shortly.' })
            return
          }
          setRefresh({ ...refresh, run, doneAt })
          return
        }
        setRefresh({ ...refresh, run: run ?? refresh.run })
      } catch (e) {
        setRefresh({ phase: 'error', message: (e as Error).message })
      }
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [refresh, repo, token, reload])

  const onRefresh = async () => {
    const before = await reload()
    if (!repo) {
      setRefresh({ phase: 'idle', note: 'Reloaded the latest prices.' })
      return
    }
    if (!token) {
      setRefresh({ phase: 'setup' })
      return
    }
    setRefresh({ phase: 'running', since: Date.now(), before })
    try {
      const run = await startRun(repo, token)
      setRefresh({ phase: 'running', run, since: Date.now(), before })
    } catch (e) {
      setRefresh({ phase: 'error', message: (e as Error).message })
    }
  }

  const onSaveToken = () => {
    const t = draft.trim()
    if (!t) return
    saveToken(t)
    setToken(t)
    setDraft('')
    setRefresh({ phase: 'idle', note: 'Token saved on this device. Tap Refresh to check every store now.' })
  }

  const onForget = () => {
    saveToken(null)
    setToken(null)
    setRefresh({ phase: 'idle', note: 'Token removed from this device.' })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-3 text-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={running}
          className="flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 font-semibold text-bg disabled:opacity-60"
        >
          <RefreshCw aria-hidden size={16} className={running ? 'animate-spin' : ''} />
          {running ? 'Checking…' : 'Refresh'}
        </button>
        <p className="min-w-0 text-muted" role="status">
          {refresh.phase === 'running' && describeRun(refresh.run)}
          {refresh.phase === 'error' && <span className="text-brand">{refresh.message}</span>}
          {refresh.phase === 'idle' &&
            (refresh.note ?? (token && repo ? 'Checks every store now and loads the new prices.' : 'Loads the latest prices.'))}
          {refresh.phase === 'setup' && 'To check every store from here, add a GitHub token on this device.'}
        </p>
      </div>

      {repo && running && refresh.run && (
        <a href={refresh.run.html_url} target="_blank" rel="noopener noreferrer" className="inline-block text-info underline-offset-2 hover:underline">
          Follow the run on GitHub
        </a>
      )}

      {repo && refresh.phase === 'setup' && (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <p>
            Create a{' '}
            <a href={newTokenPage} target="_blank" rel="noopener noreferrer" className="text-info underline">
              fine-grained GitHub token
            </a>{' '}
            with <b>Only select repositories: {repo.name}</b> and the permission <b>Actions: Read and write</b>, then paste it here.
            It stays on this device only and can do nothing but run this repository’s workflows.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2"
            />
            <button type="button" onClick={onSaveToken} className="rounded-lg bg-ink px-3 py-2 font-semibold text-bg">
              Save
            </button>
          </div>
          <p className="text-muted">
            Or start it on GitHub instead:{' '}
            <a href={actionsPage(repo)} target="_blank" rel="noopener noreferrer" className="text-info underline">
              Run workflow
            </a>
            .
          </p>
        </div>
      )}

      {repo && token && !running && (
        <button type="button" onClick={onForget} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink">
          <KeyRound aria-hidden size={13} />
          Remove the GitHub token from this device
        </button>
      )}
    </section>
  )
}
