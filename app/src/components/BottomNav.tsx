export type Tab = 'search' | 'deals' | 'shop' | 'list'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'search', label: 'Deals', icon: '🔍' },
  { id: 'deals', label: 'Top deals', icon: '🔥' },
  { id: 'shop', label: 'Shop around', icon: '🛍️' },
  { id: 'list', label: 'My list', icon: '🧺' },
]

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
  listCount: number
}

export function BottomNav({ tab, onChange, listCount }: Props) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur">
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
              <span className="text-xl leading-none">{t.icon}</span>
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
