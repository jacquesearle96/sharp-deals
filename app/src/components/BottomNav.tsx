import { Flame, Gamepad2, Search, Settings, ShoppingBag, ShoppingBasket, type LucideIcon } from 'lucide-react'
import { cx } from './ui.tsx'

export type Tab = 'search' | 'deals' | 'shop' | 'ps5' | 'list' | 'settings'

export interface TabInfo {
  id: Tab
  /** Short label for the toolbar */
  label: string
  /** Large title at the top of the screen */
  title: string
  icon: LucideIcon
}

export const TABS: TabInfo[] = [
  { id: 'search', label: 'Deals', title: 'Deals', icon: Search },
  { id: 'deals', label: 'Top deals', title: 'Top deals', icon: Flame },
  { id: 'shop', label: 'Shop', title: 'Shop around', icon: ShoppingBag },
  // TEMPORARY (Black Friday 2026)
  { id: 'ps5', label: 'PS5', title: 'PS5 prices', icon: Gamepad2 },
  { id: 'list', label: 'My list', title: 'My list', icon: ShoppingBasket },
  { id: 'settings', label: 'Settings', title: 'Settings', icon: Settings },
]

/** Every tab can be hidden from the toolbar in Settings, except Settings itself. */
export const HIDEABLE_TABS = TABS.filter((t) => t.id !== 'settings')

interface Props {
  tabs: TabInfo[]
  tab: Tab
  onChange: (tab: Tab) => void
  listCount: number
}

function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={cx(
        'grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] leading-none font-semibold text-on-brand tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function BottomNav({ tabs, tab, onChange, listCount }: Props) {
  return (
    <nav aria-label="Sections" className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-2xl px-1">
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <li key={t.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-[54px] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-brand' : 'text-muted',
                )}
              >
                <t.icon aria-hidden size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate px-0.5">{t.label}</span>
                {t.id === 'list' && <Badge count={listCount} className="absolute top-1 left-[calc(50%+6px)]" />}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** The same tabs as a row in the header, for wide screens where a bottom bar feels out of place. */
export function TopNav({ tabs, tab, onChange, listCount }: Props) {
  return (
    <nav className="hidden lg:block" aria-label="Sections">
      <ul className="flex gap-0.5 rounded-full bg-surface-2 p-1">
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.id === 'settings' ? 'Settings' : undefined}
                className={cx(
                  'flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition',
                  active ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-muted hover:text-ink',
                )}
              >
                <t.icon aria-hidden size={16} />
                {t.id !== 'settings' && t.label}
                {t.id === 'list' && <Badge count={listCount} />}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
