import { ArrowUpRight, Check, ChartLine, Plus, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { isMultiBuy, promoLabel } from '../../../shared/promo.ts'
import type { DealProduct } from '../../../shared/types.ts'
import { endsLabel, money, startsLabel } from '../lib/format.ts'
import { safeLink } from '../lib/link.ts'
import { STORE_INFO } from '../lib/stores.ts'
import { verdicts } from '../lib/verdict.ts'
import { PriceHistory } from './PriceHistory.tsx'
import { Card, cx } from './ui.tsx'

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
  const link = safeLink(deal.url)
  // Leaflet stores link to the catalogue site the deal came from, not the store's own shop.
  const linkSite = link && new URL(link).hostname.includes('cataloguespecials') ? 'the leaflet' : `the ${store.name} website`

  return (
    <Card className="p-3">
      <div className="flex gap-3">
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
          {deal.image ? (
            <img src={deal.image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-surface-2 text-faint">
              <ShoppingCart aria-hidden size={28} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: store.color }} />
            <span className="font-medium text-ink/80">{store.name}</span>
            {upcoming ? <span className="text-info">· {upcoming}</span> : ends && <span>· {ends}</span>}
          </p>

          <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug">
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" title={`Open on ${linkSite}`} className="underline-offset-2 hover:underline">
                {deal.name}
                <ArrowUpRight aria-label={`(opens ${linkSite})`} size={14} className="ml-0.5 inline align-[-2px] text-faint" />
              </a>
            ) : (
              deal.name
            )}
          </h3>

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="min-w-0">
              {multi && label && (
                <span className="mb-1 inline-block rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand">{label}</span>
              )}
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-lg font-semibold tracking-tight tabular-nums">{money(deal.effectivePrice)}</span>
                {showEach && <span className="text-xs text-muted">each</span>}
                {reference > deal.effectivePrice && <s className="text-xs text-faint tabular-nums">{money(reference)}</s>}
                {deal.savePct > 0 && <span className="text-xs font-semibold text-ok">−{deal.savePct}%</span>}
              </p>
            </div>

            <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              aria-label="Price history"
              title="Price history"
              className={cx(
                'grid h-9 w-9 place-items-center rounded-full transition',
                showHistory ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <ChartLine aria-hidden size={17} />
            </button>
            <button
              type="button"
              onClick={() => onToggle(deal)}
              aria-pressed={inList}
              aria-label={inList ? `Remove ${deal.name} from list` : `Add ${deal.name} to list`}
              className={cx(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90',
                inList ? 'bg-ink text-bg' : 'bg-surface-2 text-ink hover:bg-line',
              )}
            >
              {inList ? <Check aria-hidden size={18} strokeWidth={2.4} /> : <Plus aria-hidden size={18} strokeWidth={2.2} />}
            </button>
            </div>
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {notes.map((n) => (
            <li
              key={n.text}
              className={cx('rounded-md px-1.5 py-0.5 text-xs font-medium', n.kind === 'good' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}
            >
              {n.text}
            </li>
          ))}
        </ul>
      )}
      {showHistory && (
        <div className="mt-3 border-t border-line pt-3">
          <PriceHistory store={deal.store} id={deal.id} today={today()} />
        </div>
      )}
    </Card>
  )
}
