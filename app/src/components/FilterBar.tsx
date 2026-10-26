import { STORES, type StoreId } from '../../../shared/types.ts'
import type { Filters, SortKey } from '../lib/query.ts'
import { STORE_INFO } from '../lib/stores.ts'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  /** Number of deals per store before store filtering, shown on the chips */
  counts: Partial<Record<StoreId, number>>
  hideSearch?: boolean
}

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'relevance', label: 'Best match' },
  { id: 'saving', label: 'Biggest saving' },
  { id: 'price', label: 'Lowest price' },
  { id: 'ending', label: 'Ending soon' },
]

export function FilterBar({ filters, onChange, counts, hideSearch }: Props) {
  const toggleStore = (id: StoreId) =>
    onChange({
      ...filters,
      stores: filters.stores.includes(id) ? filters.stores.filter((s) => s !== id) : [...filters.stores, id],
    })

  return (
    <div className="space-y-3">
      {!hideSearch && (
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm focus-within:border-brand">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            value={filters.text}
            onChange={(e) => onChange({ ...filters, text: e.target.value })}
            placeholder="Search nappies, coffee, chocolate…"
            enterKeyHint="search"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted"
          />
        </label>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {STORES.map((id) => {
          const on = filters.stores.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleStore(id)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STORE_INFO[id].color }} />
              {STORE_INFO[id].name}
              <span className={on ? 'opacity-70' : 'text-muted'}>{counts[id] ?? 0}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange({ ...filters, multiBuyOnly: !filters.multiBuyOnly })}
          aria-pressed={filters.multiBuyOnly}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
            filters.multiBuyOnly
              ? 'border-transparent bg-gradient-to-r from-brand to-brand2 text-white'
              : 'border-line bg-surface'
          }`}
        >
          3 for 2 &amp; multi-buys
        </button>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Sort by</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
