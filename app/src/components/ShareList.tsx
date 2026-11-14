import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { SyncStatus } from '../lib/list.ts'
import { formatCode, normalizeCode } from '../lib/sync.ts'
import { Button, cx } from './ui.tsx'

interface Props {
  household: string | null
  status: SyncStatus
  onStart: () => void
  onJoin: (code: string) => void
  onLeave: () => void
}

/** The one-line state of sharing, for the row in Settings. */
export function shareSummary(household: string | null, status: SyncStatus, canShare: boolean): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (!canShare) return { text: 'Not set up', tone: 'muted' }
  if (!household) return { text: 'Off', tone: 'muted' }
  if (status === 'error') return { text: 'Offline', tone: 'warn' }
  if (status === 'ok') return { text: 'On', tone: 'ok' }
  return { text: 'Connecting', tone: 'muted' }
}

/** Lets two phones share one shopping list with a private code. Shown in a sheet from Settings. */
export function SharePanel({ household, status, onStart, onJoin, onLeave }: Props) {
  const [entry, setEntry] = useState('')
  const [copied, setCopied] = useState(false)
  const code = normalizeCode(entry)

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
      <div className="space-y-4">
        <p className="text-[15px] text-muted">Enter this code on your partner’s phone. You’ll both see and edit the same list.</p>
        <code className="block rounded-2xl bg-surface-2 px-3 py-4 text-center font-mono text-[22px] font-medium tracking-[0.18em]">
          {formatCode(household)}
        </code>
        <Button variant="primary" onClick={copy} className="w-full">
          {copied ? <Check aria-hidden size={16} /> : <Copy aria-hidden size={16} />}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        <p className={cx('flex items-center justify-center gap-1.5 text-[13px]', status === 'error' ? 'text-warn' : 'text-muted')} role="status">
          <span aria-hidden className={cx('h-2 w-2 rounded-full', status === 'ok' ? 'bg-ok' : status === 'error' ? 'bg-warn' : 'bg-faint')} />
          {status === 'ok'
            ? 'Up to date'
            : status === 'error'
              ? 'Can’t reach the shared list. Changes are kept and sent when you’re back online.'
              : 'Connecting…'}
        </p>
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-[13px] text-muted">Treat the code like a password: anyone who has it can change your list.</p>
          <Button variant="ghost" onClick={onLeave} className="-ml-2 text-warn hover:text-warn">
            Stop sharing on this phone
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-muted">Share one shopping list between two phones. The items already on this phone are added to it.</p>
      <Button variant="primary" onClick={onStart} className="w-full">
        Create a shared list
      </Button>
      <div className="flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" />
        or join your partner’s
        <span className="h-px flex-1 bg-line" />
      </div>
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
          placeholder="XXXX-XXXX-XXXX"
          aria-label="Your partner’s code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-full bg-surface-2 px-4 font-mono text-base tracking-wider outline-none placeholder:text-faint focus:ring-2 focus:ring-ink/20"
        />
        <Button type="submit" disabled={!code}>
          Join
        </Button>
      </form>
    </div>
  )
}
