import { useEffect, useState } from 'react'
import type { StoreId } from '../../../shared/types.ts'
import { money } from '../lib/format.ts'

type Series = [string, number][]
type StoreHistory = Record<string, Series>

// One download per store per visit, shared by every card that asks.
const cache = new Map<StoreId, Promise<StoreHistory>>()

function loadHistory(store: StoreId): Promise<StoreHistory> {
  let p = cache.get(store)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/history/${store}.json`).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<StoreHistory>
    })
    p.catch(() => cache.delete(store))
    cache.set(store, p)
  }
  return p
}

const W = 300
const H = 90
const PAD = 6

/** Step chart: a price holds until the next recorded change. */
export function PriceHistory({ store, id, today }: { store: StoreId; id: string; today: string }) {
  const [series, setSeries] = useState<Series | null | 'error'>(null)

  useEffect(() => {
    let cancelled = false
    loadHistory(store)
      .then((h) => !cancelled && setSeries(h[id] ?? []))
      .catch(() => !cancelled && setSeries('error'))
    return () => {
      cancelled = true
    }
  }, [store, id])

  if (series === null) return <p className="px-1 text-xs text-muted">Loading price history…</p>
  if (series === 'error' || series.length === 0) {
    return <p className="px-1 text-xs text-muted">No price history yet. We start tracking from the first time a price is scraped.</p>
  }

  const points: [number, number][] = [...series.map(([d, p]) => [Date.parse(d), p] as [number, number]), [Date.parse(today), series[series.length - 1][1]]]
  const t0 = points[0][0]
  const t1 = Math.max(points[points.length - 1][0], t0 + 86_400_000)
  const prices = points.map((p) => p[1])
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const x = (t: number) => PAD + ((t - t0) / (t1 - t0)) * (W - 2 * PAD)
  const y = (v: number) => (hi === lo ? H / 2 : PAD + (1 - (v - lo) / (hi - lo)) * (H - 2 * PAD))

  let d = `M ${x(points[0][0])} ${y(points[0][1])}`
  for (let i = 1; i < points.length; i++) d += ` H ${x(points[i][0])} V ${y(points[i][1])}`

  return (
    <div className="px-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={`Price history, from ${money(lo)} to ${money(hi)}`}>
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-xs text-muted">
        <span>{series[0][0]}</span>
        <span>
          Low {money(lo)} · High {money(hi)}
        </span>
        <span>Today</span>
      </div>
    </div>
  )
}
