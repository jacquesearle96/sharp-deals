import { Flame, Gamepad2, Search, ShoppingBag, ShoppingBasket, type LucideIcon } from 'lucide-react'

export type Tab = 'search' | 'deals' | 'shop' | 'ps5' | 'list'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'search', label: 'Deals', icon: Search },
  { id: 'deals', label: 'Top deals', icon: Flame },
  { id: 'shop', label: 'Shop around', icon: ShoppingBag },
  // TEMPORARY (Black Friday 2026)
  { id: 'ps5', label: 'PS5', icon: Gamepad2 },
  { id: 'list', label: 'My list', icon: ShoppingBasket },
]

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
  listCount: number
}

export function BottomNav({ tab, onChange, listCount }: Props) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((t) => (
          <li key={t.id} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`relative flex w-full flex-col items-center gap-0.5 py-2 text-xs font-semibold transition ${
                tab === t.id ? 'text-brand' : 'text-muted'
              }`}
            >
              <t.icon aria-hidden size={22} strokeWidth={tab === t.id ? 2.4 : 2} />
              {t.label}
              {t.id === 'list' && listCount > 0 && (
                <span className="absolute right-[28%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {listCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** The same tabs as a row in the header, for wide screens where a bottom bar feels out of place. */
export function TopNav({ tab, onChange, listCount }: Props) {
  return (
    <nav className="hidden lg:block" aria-label="Sections">
      <ul className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {TABS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? 'bg-ink text-bg' : 'text-muted hover:text-ink'
              }`}
            >
              <t.icon aria-hidden size={16} />
              {t.label}
              {t.id === 'list' && listCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                  {listCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
