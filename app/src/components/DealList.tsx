import { useEffect, useState } from 'react'
import type { DealProduct } from '../../../shared/types.ts'
import { DealCard } from './DealCard.tsx'

const PAGE = 40

interface Props {
  deals: DealProduct[]
  has: (deal: DealProduct) => boolean
  onToggle: (deal: DealProduct) => void
  empty: string
}

/** Renders a long result list in chunks so the page stays quick on a phone. */
export function DealList({ deals, has, onToggle, empty }: Props) {
  const [shown, setShown] = useState(PAGE)

  // A new result set starts back at the top chunk.
  useEffect(() => setShown(PAGE), [deals])

  if (deals.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{empty}</p>
  }

  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <p className="col-span-full text-sm text-muted">
        {deals.length.toLocaleString('en-ZA')} deal{deals.length === 1 ? '' : 's'}
      </p>
      {deals.slice(0, shown).map((d) => (
        <DealCard key={`${d.store}:${d.id}`} deal={d} inList={has(d)} onToggle={onToggle} />
      ))}
      {shown < deals.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="col-span-full w-full rounded-2xl border border-line bg-surface py-3 text-sm font-semibold transition hover:border-muted active:scale-[0.99] lg:mx-auto lg:max-w-sm"
        >
          Show more ({deals.length - shown} left)
        </button>
      )}
    </div>
  )
}
