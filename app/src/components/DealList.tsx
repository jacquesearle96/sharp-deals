import { useEffect, useState } from 'react'
import type { DealProduct } from '../../../shared/types.ts'
import { SearchX } from 'lucide-react'
import { DealCard } from './DealCard.tsx'
import { Button, Empty } from './ui.tsx'

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
    return <Empty icon={<SearchX size={22} />} title={empty} />
  }

  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <p className="col-span-full px-1 text-[13px] text-muted">
        {deals.length.toLocaleString('en-ZA')} deal{deals.length === 1 ? '' : 's'}
      </p>
      {deals.slice(0, shown).map((d) => (
        <DealCard key={`${d.store}:${d.id}`} deal={d} inList={has(d)} onToggle={onToggle} />
      ))}
      {shown < deals.length && (
        <Button onClick={() => setShown((n) => n + PAGE)} className="col-span-full mx-auto mt-2">
          Show more · {(deals.length - shown).toLocaleString('en-ZA')} left
        </Button>
      )}
    </div>
  )
}
