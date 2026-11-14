import { ChevronRight, X } from 'lucide-react'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Health } from '../lib/status.ts'

/** Shared building blocks, so every screen uses the same shapes, spacing and states. */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

/** A rounded surface. Everything that groups content sits on one of these. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' }

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-ink text-bg hover:opacity-90',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ink',
        className,
      )}
    />
  )
}

/** An on/off switch with its accessible name supplied by the row it sits in. */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        'relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors disabled:opacity-40',
        on ? 'bg-ok' : 'bg-surface-2 ring-1 ring-inset ring-line',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform',
          on && 'translate-x-5',
        )}
      />
    </button>
  )
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition',
            value === o.id ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A filter chip that toggles. */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition',
        on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

/** A titled group of rows, iOS Settings style. */
export function Group({ title, footer, action, children }: { title: string; footer?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-8 items-end justify-between gap-3 px-1">
        <h2 className="text-[13px] font-medium tracking-wide text-muted uppercase">{title}</h2>
        {action}
      </div>
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
      {footer && <div className="px-1 text-[13px] leading-snug text-muted">{footer}</div>}
    </section>
  )
}

/** One line in a Group: an optional leading item, a title with optional detail, and a trailing control. */
export function Row({ leading, title, detail, trailing }: { leading?: ReactNode; title: ReactNode; detail?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug">{title}</div>
        {detail && <div className="mt-0.5 text-[13px] leading-snug text-muted">{detail}</div>}
      </div>
      {trailing}
    </div>
  )
}

const HEALTH_DOT: Record<Health, string> = { ok: 'bg-ok', failing: 'bg-warn', off: 'bg-faint' }

export function HealthDot({ health }: { health: Health }) {
  return <span aria-hidden className={cx('inline-block h-2 w-2 shrink-0 rounded-full', HEALTH_DOT[health])} />
}

/** A friendly empty or error state. */
export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

/** A short inline message: neutral, success or a problem. */
export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn'; children: ReactNode }) {
  return (
    <p
      role="status"
      className={cx(
        'rounded-xl px-3 py-2 text-[13px] leading-snug',
        tone === 'neutral' && 'bg-surface-2 text-muted',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
      )}
    >
      {children}
    </p>
  )
}

/** A Group row that opens something: a sub-page or a sheet. Shows a short value and a chevron. */
export function NavRow({
  leading,
  title,
  detail,
  value,
  onClick,
  disabled,
}: {
  leading?: ReactNode
  title: ReactNode
  detail?: ReactNode
  value?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2/60 active:bg-surface-2 disabled:pointer-events-none"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug">{title}</span>
        {detail && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{detail}</span>}
      </span>
      {value && <span className="shrink-0 text-[15px] text-muted">{value}</span>}
      {!disabled && <ChevronRight aria-hidden size={18} className="shrink-0 text-faint" />}
    </button>
  )
}

/** A rounded tile behind a row's icon, iOS Settings style. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', className)}>{children}</span>
}

/**
 * A modal sheet: slides up from the bottom on a phone, a centred dialog on wide screens. Built on <dialog>, so focus
 * stays inside while open and Escape closes it. A tap outside closes it too.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="sheet mt-auto mb-0 w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/45 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="safe-bottom max-h-[85dvh] overflow-y-auto">
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-1 sm:pt-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted hover:text-ink"
          >
            <X aria-hidden size={16} />
          </button>
        </div>
        <div className="px-5 pt-2 pb-6">{children}</div>
      </div>
    </dialog>
  )
}
