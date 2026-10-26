import { useState } from 'react'
import { isMultiBuy, promoLabel } from '../../../shared/promo.ts'
import type { DealProduct } from '../../../shared/types.ts'
import { endsLabel, money, startsLabel } from '../lib/format.ts'
import { STORE_INFO } from '../lib/stores.ts'
import { verdicts } from '../lib/verdict.ts'
import { PriceHistory } from './PriceHistory.tsx'

interface Props {
  deal: DealProduct
  inList: boolean
  onToggle: (deal: DealProduct) => void
}

const today = () => new Date().toISOString().slice(0, 10)

export function DealCard({ deal, inList, onToggle }: Props) {
  const [showHistory, setShowHistory] = useState(false)
  const store = STORE_INFO[deal.store]
  const multi = isMultiBuy(deal.promo)
  const label = promoLabel(deal.promo)
  const upcoming = startsLabel(deal.promoStarts)
  const ends = endsLabel(deal.promoEnds)
  const reference = deal.wasPrice ?? deal.price
  const showEach = multi && deal.effectivePrice < deal.price
  const notes = verdicts(deal)

  return (
    <article className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white">
          {deal.image ? (
            <img src={deal.image} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full w-full place-items-center text-3xl">🛒</div>
          )}
          {deal.savePct > 0 && (
            <span className="absolute left-1 top-1 rounded-md bg-ok px-1.5 py-0.5 text-[11px] font-bold text-white">
              -{deal.savePct}%
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: store.color }} />
            {store.name}
            {upcoming && <span className="rounded-full bg-info/15 px-2 py-0.5 text-info">{upcoming}</span>}
            {!upcoming && ends && <span>· {ends}</span>}
          </div>

          <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug">{deal.name}</h3>

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="min-w-0">
              {multi && label && (
                <span className="mb-1 inline-block rounded-full bg-gradient-to-r from-brand to-brand2 px-2.5 py-0.5 text-xs font-bold text-white">
                  {label}
                </span>
              )}
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold tracking-tight">{money(deal.effectivePrice)}</span>
                {showEach && <span className="text-xs text-muted">each</span>}
                {reference > deal.effectivePrice && (
                  <span className="text-xs text-muted line-through">{money(reference)}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggle(deal)}
              aria-pressed={inList}
              aria-label={inList ? 'Remove from list' : 'Add to list'}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg transition active:scale-90 ${
                inList ? 'border-brand bg-brand text-white' : 'border-line bg-bg text-ink'
              }`}
            >
              {inList ? '✓' : '+'}
            </button>
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {notes.map((n) => (
            <li
              key={n.text}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                n.kind === 'good' ? 'bg-ok/15 text-ok' : 'bg-brand2/20 text-brand'
              }`}
            >
              {n.kind === 'good' ? '✓ ' : '⚠ '}
              {n.text}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        aria-expanded={showHistory}
        className="mt-2 text-xs font-semibold text-muted"
      >
        📈 {showHistory ? 'Hide price history' : 'Price history'}
      </button>
      {showHistory && (
        <div className="mt-2">
          <PriceHistory store={deal.store} id={deal.id} today={today()} />
        </div>
      )}
    </article>
  )
}
