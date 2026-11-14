import { ArrowUpDown, Search, X } from 'lucide-react'
import { DEAL_STORES, type StoreId } from '../../../shared/types.ts'
import type { Filters, SortKey } from '../lib/query.ts'
import { STORE_INFO } from '../lib/stores.ts'
import { Chip } from './ui.tsx'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  /** Number of deals per store before store filtering, shown on the chips */
  counts: Partial<Record<StoreId, number>>
  hideSearch?: boolean
  /** Which store chips to show; defaults to the main deal stores */
  stores?: StoreId[]
  /** Show an "On special" toggle (for catalogues that list full-price items too) */
  showOnSale?: boolean
}

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'relevance', label: 'Best match' },
  { id: 'saving', label: 'Biggest saving' },
  { id: 'price', label: 'Lowest price' },
  { id: 'ending', label: 'Ending soon' },
]

/** A search field, a field-like box shared with Shop around. */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-ink/15">
      <Search aria-hidden size={18} className="shrink-0 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        enterKeyHint="search"
        className="w-full bg-transparent text-base outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="grid h-6 w-6 place-items-center rounded-full bg-faint/30 text-ink">
          <X aria-hidden size={14} />
        </button>
      )}
    </label>
  )
}

export function FilterBar({ filters, onChange, counts, hideSearch, stores = DEAL_STORES, showOnSale }: Props) {
  const toggleStore = (id: StoreId) =>
    onChange({
      ...filters,
      stores: filters.stores.includes(id) ? filters.stores.filter((s) => s !== id) : [...filters.stores, id],
    })
  // A store switched off in Settings has no deals; leave its chip out rather than show a dead "0".
  const shown = stores.filter((id) => (counts[id] ?? 0) > 0 || filters.stores.includes(id))

  return (
    <div className="space-y-3">
      {!hideSearch && (
        <SearchField value={filters.text} onChange={(text) => onChange({ ...filters, text })} placeholder="Search nappies, coffee…" />
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {shown.map((id) => (
          <Chip key={id} on={filters.stores.includes(id)} onClick={() => toggleStore(id)}>
            {STORE_INFO[id].name}
            <span className="tabular-nums opacity-60">{(counts[id] ?? 0).toLocaleString('en-ZA')}</span>
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {showOnSale ? (
          <Chip on={!!filters.onSaleOnly} onClick={() => onChange({ ...filters, onSaleOnly: !filters.onSaleOnly })}>
            On special only
          </Chip>
        ) : (
          <Chip on={filters.multiBuyOnly} onClick={() => onChange({ ...filters, multiBuyOnly: !filters.multiBuyOnly })}>
            Multi-buys only
          </Chip>
        )}
        <label className="relative flex items-center text-[13px] text-muted">
          <ArrowUpDown aria-hidden size={14} className="pointer-events-none absolute left-3" />
          <span className="sr-only">Sort by</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}
            className="h-8 appearance-none rounded-full border border-line bg-surface pr-3 pl-8 text-[13px] font-medium text-ink outline-none"
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
