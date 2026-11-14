import { Gamepad2, RefreshCw, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { modelOf, PS5_STORES, sortOffers, type Ps5Model, type Ps5Offer } from '../../../shared/ps5.ts'
import { ago, money } from '../lib/format.ts'
import { describeRun, isActive, latestRun, startRun, useGithub, type Run } from '../lib/github.ts'
import { safeLink } from '../lib/link.ts'
import { usePs5Feed } from '../lib/ps5Feed.ts'
import { daysToBlackFriday } from '../lib/retailers.ts'
import { Button, Card, cx, Empty, Segmented } from './ui.tsx'

/**
 * TEMPORARY (Black Friday 2026): every PS5 console listing from the SA stores we read, cheapest first.
 * Delete this file, its tab in BottomNav/App, lib/ps5Feed.ts, shared/ps5.ts, scraper/src/ps5/ and
 * .github/workflows/ps5.yml afterwards.
 */

type Model = 'all' | Ps5Model

const MODELS: { id: Model; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'digital', label: 'Digital' },
  { id: 'disc', label: 'Disc' },
  { id: 'pro', label: 'Pro' },
]

export function Ps5Deals({ onOpenSettings }: { onOpenSettings: () => void }) {
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
        <Empty icon={<Gamepad2 size={22} />} title="No PS5 prices yet">
          {state.message}
        </Empty>
        <RefreshBar reload={reload} onOpenSettings={onOpenSettings} />
      </div>
    )

  const { feed } = state
  const hiddenOutOfStock = feed.offers.filter((o) => o.inStock === false).length
  const storesOn = Object.keys(PS5_STORES).length - (feed.off?.length ?? 0)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-sm text-muted">
        {days > 0 ? `Black Friday in ${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'It’s Black Friday' : 'Black Friday has passed'}
        {' · '}
        {storesOn} stores · updated {ago(feed.generatedAt)}
      </p>

      <RefreshBar reload={reload} onOpenSettings={onOpenSettings} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Model" options={MODELS} value={model} onChange={setModel} className="w-full sm:w-auto" />
        {hiddenOutOfStock > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showOutOfStock}
              onChange={(e) => setShowOutOfStock(e.target.checked)}
              className="h-4 w-4 accent-[var(--ink)]"
            />
            Include out of stock ({hiddenOutOfStock})
          </label>
        )}
      </div>

      {offers.length === 0 ? (
        <Empty title="No consoles match">Try another model, or include out-of-stock listings.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-line">
            {offers.map((o, i) => (
              <OfferRow key={`${o.store}:${o.url}`} offer={o} rank={i + 1} />
            ))}
          </ol>
        </Card>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">
        Prices are read from each store’s website and can lag by up to an hour. Takealot, Amazon and Makro include marketplace
        sellers. Check the price on the store’s page before buying.
      </p>
    </div>
  )
}

function OfferRow({ offer: o, rank }: { offer: Ps5Offer; rank: number }) {
  const link = safeLink(o.url)
  const savePct = o.wasPrice ? Math.round((1 - o.price / o.wasPrice) * 100) : 0
  const best = rank === 1 && o.inStock !== false
  const content = (
    <>
      <img
        src={`${import.meta.env.BASE_URL}logos/${o.store}.${o.store === 'computermania' ? 'svg' : 'png'}`}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-line"
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className="font-medium text-ink">{PS5_STORES[o.store]}</span>
          {best && (
            <span className="inline-flex items-center gap-1 font-medium text-ok">
              <Trophy aria-hidden size={12} />
              Cheapest
            </span>
          )}
          {o.inStock === false && <span className="font-medium text-warn">Out of stock</span>}
          {/parallel import/i.test(o.name) && <span className="font-medium text-info">Parallel import</span>}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug">{o.name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[17px] font-semibold tabular-nums">{money(o.price)}</p>
        {o.wasPrice && (
          <p className="text-xs text-muted tabular-nums">
            <s>{money(o.wasPrice)}</s> <span className="font-medium text-ok">−{savePct}%</span>
          </p>
        )}
      </div>
    </>
  )
  return (
    <li className={cx(o.inStock === false && 'opacity-55')}>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${o.name}, ${money(o.price)} at ${PS5_STORES[o.store]} (opens the store)`}
          className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60"
        >
          {content}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{content}</div>
      )}
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
  | { phase: 'error'; message: string }

/**
 * Refresh reloads the latest prices at once. With GitHub connected in Settings it also starts a fresh check of
 * every store (the ps5.yml workflow) and follows it until the new prices are published.
 */
function RefreshBar({ reload, onOpenSettings }: { reload: () => Promise<string | undefined>; onOpenSettings: () => void }) {
  const { repo, token } = useGithub()
  const [refresh, setRefresh] = useState<Refresh>({ phase: 'idle' })
  const running = refresh.phase === 'running'
  const connected = !!(repo && token)

  // A run that is already going (the hourly one, or one started earlier) is followed too.
  useEffect(() => {
    if (!repo || !token) return
    let cancelled = false
    latestRun(repo, token, 'ps5')
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
        const run = await latestRun(repo, token, 'ps5')
        if (run?.status === 'completed' && (!refresh.run || run.id === refresh.run.id)) {
          if (run.conclusion !== 'success' && run.conclusion !== 'failure') {
            setRefresh({ phase: 'error', message: describeRun(run, 'ps5') })
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
            setRefresh({ phase: 'idle', note: 'The check finished, but the published prices haven’t changed yet. Try again shortly.' })
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
    if (!repo || !token) {
      setRefresh({ phase: 'idle', note: 'Loaded the latest published prices.' })
      return
    }
    setRefresh({ phase: 'running', since: Date.now(), before })
    try {
      const run = await startRun(repo, token, 'ps5')
      setRefresh({ phase: 'running', run, since: Date.now(), before })
    } catch (e) {
      setRefresh({ phase: 'error', message: (e as Error).message })
    }
  }

  return (
    <Card className="flex items-center gap-3 p-3">
      <Button variant="primary" onClick={onRefresh} disabled={running}>
        <RefreshCw aria-hidden size={16} className={running ? 'animate-spin' : ''} />
        {running ? 'Checking' : 'Refresh'}
      </Button>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted" role="status">
        {refresh.phase === 'running' && (
          <>
            {describeRun(refresh.run, 'ps5')}{' '}
            {refresh.run && (
              <a href={refresh.run.html_url} target="_blank" rel="noopener noreferrer" className="text-info underline-offset-2 hover:underline">
                View run
              </a>
            )}
          </>
        )}
        {refresh.phase === 'error' && <span className="text-warn">{refresh.message}</span>}
        {refresh.phase === 'idle' &&
          (refresh.note ??
            (connected ? (
              'Checks every store now, then loads the new prices.'
            ) : (
              <>
                Loads the latest published prices.{' '}
                {repo && (
                  <button type="button" onClick={onOpenSettings} className="text-info underline-offset-2 hover:underline">
                    Connect GitHub
                  </button>
                )}
                {repo && ' to check stores on demand.'}
              </>
            )))}
      </p>
    </Card>
  )
}
