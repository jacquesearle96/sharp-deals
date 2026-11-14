import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { SyncStatus } from '../lib/list.ts'
import { formatCode, normalizeCode } from '../lib/sync.ts'
import { Button, Group, Row } from './ui.tsx'

interface Props {
  household: string | null
  status: SyncStatus
  canShare: boolean
  onStart: () => void
  onJoin: (code: string) => void
  onLeave: () => void
}

const STATUS: Record<SyncStatus, { text: string; dot: string }> = {
  unconfigured: { text: '', dot: '' },
  off: { text: '', dot: '' },
  syncing: { text: 'Connecting', dot: 'bg-faint' },
  ok: { text: 'Up to date', dot: 'bg-ok' },
  error: { text: 'Offline', dot: 'bg-warn' },
}

/** Lets two phones share one shopping list with a private code. Lives in Settings. */
export function ShareList({ household, status, canShare, onStart, onJoin, onLeave }: Props) {
  const [entry, setEntry] = useState('')
  const [copied, setCopied] = useState(false)
  const code = normalizeCode(entry)

  if (!canShare) {
    return (
      <Group title="Shared list">
        <Row title="Not set up" detail="Sharing needs a free Supabase project, set up once. See supabase/README.md in the repository." />
      </Group>
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
    const s = STATUS[status]
    return (
      <Group
        title="Shared list"
        action={
          s.text && (
            <span className="flex items-center gap-1.5 pb-0.5 text-[13px] text-muted">
              <span aria-hidden className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.text}
            </span>
          )
        }
        footer={
          status === 'error'
            ? 'Can’t reach the shared list right now. Changes are kept on this phone and sent when you’re back online.'
            : 'Anyone with this code sees and edits the same list. Treat it like a password.'
        }
      >
        <div className="space-y-3 p-4">
          <p className="text-[13px] text-muted">Enter this code on your partner’s phone</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-2.5 text-center font-mono text-[17px] font-medium tracking-[0.15em]">
              {formatCode(household)}
            </code>
            <Button onClick={copy} aria-label="Copy code">
              {copied ? <Check aria-hidden size={16} /> : <Copy aria-hidden size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <button type="button" onClick={onLeave} className="flex min-h-12 w-full items-center px-4 text-left text-[15px] text-warn hover:bg-surface-2/60">
          Stop sharing on this phone
        </button>
      </Group>
    )
  }

  return (
    <Group title="Shared list" footer="Share one shopping list between two phones. Your current items are added to it.">
      <div className="space-y-3 p-4">
        <Button variant="primary" onClick={onStart} className="w-full">
          Create a shared list
        </Button>
        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          or join one
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
            className="h-10 min-w-0 flex-1 rounded-full bg-surface-2 px-4 font-mono text-[15px] tracking-wider outline-none placeholder:text-faint focus:ring-2 focus:ring-ink/20"
          />
          <Button type="submit" disabled={!code}>
            Join
          </Button>
        </form>
      </div>
    </Group>
  )
}
