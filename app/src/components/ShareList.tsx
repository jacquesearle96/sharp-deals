import { useState } from 'react'
import type { SyncStatus } from '../lib/list.ts'
import { formatCode, normalizeCode } from '../lib/sync.ts'

interface Props {
  household: string | null
  status: SyncStatus
  canShare: boolean
  onStart: () => void
  onJoin: (code: string) => void
  onLeave: () => void
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  unconfigured: '',
  off: '',
  syncing: 'Connecting…',
  ok: 'Up to date',
  error: 'Can’t reach the shared list. Your changes are kept and will send when you’re back online.',
}

/** Lets two phones share one shopping list with a private code. */
export function ShareList({ household, status, canShare, onStart, onJoin, onLeave }: Props) {
  const [entry, setEntry] = useState('')
  const [copied, setCopied] = useState(false)
  const code = normalizeCode(entry)

  if (!canShare) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
        Sharing this list with your partner isn’t switched on yet. It needs a free Supabase project, set up once.
        See <code>supabase/README.md</code>.
      </p>
    )
  }

  if (household) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(formatCode(household))
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        // Clipboard blocked: the code is on screen to read out.
      }
    }
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Shared list</p>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-2 w-2 rounded-full ${status === 'ok' ? 'bg-ok' : status === 'error' ? 'bg-brand' : 'bg-brand2'}`} />
            {status === 'ok' ? 'Up to date' : status === 'error' ? 'Offline' : 'Syncing'}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">Enter this code on your partner’s phone:</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded-xl bg-bg px-3 py-2 text-center text-lg font-bold tracking-widest">{formatCode(household)}</code>
          <button type="button" onClick={copy} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {status === 'error' && <p className="mt-2 text-xs text-muted">{STATUS_TEXT.error}</p>}
        <button type="button" onClick={onLeave} className="mt-3 text-xs font-semibold text-muted underline">
          Stop sharing on this phone
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold">Share this list</p>
      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-xl bg-gradient-to-r from-brand to-brand2 py-2.5 text-sm font-bold text-white active:scale-[0.99]"
      >
        Start a shared list
      </button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (code) {
            onJoin(code)
            setEntry('')
          }
        }}
      >
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Or enter your partner’s code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={!code}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Join
        </button>
      </form>
    </div>
  )
}
