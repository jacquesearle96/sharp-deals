import { KeyRound, Monitor, Moon, Play, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PS5_STORES, type Ps5StoreId } from '../../../shared/ps5.ts'
import { formatOff, OFF_VARIABLES, parseOff, type Scrape } from '../../../shared/storeSwitches.ts'
import { DEAL_STORES, type StoreId } from '../../../shared/types.ts'
import type { IndexState } from '../lib/data.ts'
import { ago } from '../lib/format.ts'
import { describeRun, getVariable, isActive, latestRun, newTokenPage, saveToken, setVariable, startRun, useGithub, type Run } from '../lib/github.ts'
import type { useShoppingList } from '../lib/list.ts'
import type { Theme } from '../lib/prefs.ts'
import { usePs5Feed } from '../lib/ps5Feed.ts'
import { storeStatus, type RunLike } from '../lib/status.ts'
import { STORE_INFO } from '../lib/stores.ts'
import { HIDEABLE_TABS, type Tab } from './BottomNav.tsx'
import { ShareList } from './ShareList.tsx'
import { Button, Group, HealthDot, Notice, Row, Segmented, Switch } from './ui.tsx'

interface Props {
  theme: Theme
  onTheme: (theme: Theme) => void
  hiddenTabs: Tab[]
  onToggleTab: (tab: Tab) => void
  list: ReturnType<typeof useShoppingList>
  deals: IndexState
}

const THEMES: { id: Theme; label: ReactNode }[] = [
  { id: 'system', label: <><Monitor aria-hidden size={14} />Auto</> },
  { id: 'light', label: <><Sun aria-hidden size={14} />Light</> },
  { id: 'dark', label: <><Moon aria-hidden size={14} />Dark</> },
]

export function Settings({ theme, onTheme, hiddenTabs, onToggleTab, list, deals }: Props) {
  const ps5 = usePs5Feed()
  const groceryRuns = deals.status === 'ready' ? deals.index.runs : []
  const ps5Runs = ps5.state.status === 'ready' ? ps5.state.feed.runs : []

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Group title="Appearance" footer="Auto follows your phone’s light or dark setting.">
        <div className="p-3">
          <Segmented label="Theme" options={THEMES} value={theme} onChange={onTheme} />
        </div>
      </Group>

      <Group title="Toolbar" footer="Choose which tabs appear in the toolbar. Settings is always there.">
        {HIDEABLE_TABS.map((t) => {
          const shown = !hiddenTabs.includes(t.id)
          return (
            <Row
              key={t.id}
              leading={<t.icon aria-hidden size={20} className="text-muted" />}
              title={t.title}
              trailing={<Switch on={shown} onChange={() => onToggleTab(t.id)} label={`Show ${t.title} in the toolbar`} />}
            />
          )
        })}
      </Group>

      <ShareList
        household={list.household}
        status={list.status}
        canShare={list.canShare}
        onStart={list.startSharing}
        onJoin={list.join}
        onLeave={list.leave}
      />

      <StoreSwitches
        scrape="grocery"
        title="Grocery & baby stores"
        schedule="Scraped every 6 hours."
        stores={DEAL_STORES.map((id) => ({ id, name: STORE_INFO[id].name }))}
        runs={new Map<string, RunLike>(groceryRuns.map((r) => [r.store, r]))}
        publishedOff={deals.status === 'ready' ? (deals.index.off ?? []) : []}
        unit={['deal', 'deals']}
      />

      <StoreSwitches
        scrape="ps5"
        title="PS5 stores"
        schedule="Checked every hour during November."
        stores={(Object.keys(PS5_STORES) as Ps5StoreId[]).map((id) => ({ id, name: PS5_STORES[id] }))}
        runs={new Map<string, RunLike>(ps5Runs.map((r) => [r.store, r]))}
        publishedOff={ps5.state.status === 'ready' ? (ps5.state.feed.off ?? []) : []}
        unit={['console', 'consoles']}
      />

      <GithubAccess />
    </div>
  )
}

/**
 * One scrape's stores: how each did on its latest run, and a switch to stop scraping it. The switches edit a GitHub
 * repository variable the workflow reads, so they need the token from "GitHub access" below.
 */
function StoreSwitches<T extends StoreId | Ps5StoreId>({
  scrape,
  title,
  schedule,
  stores,
  runs,
  publishedOff,
  unit,
}: {
  scrape: Scrape
  title: string
  schedule: string
  stores: { id: T; name: string }[]
  runs: Map<string, RunLike>
  /** Stores the latest published data was built without */
  publishedOff: string[]
  unit: [string, string]
}) {
  const { repo, token } = useGithub()
  const connected = !!(repo && token)
  const ids = stores.map((s) => s.id)
  const variable = OFF_VARIABLES[scrape]
  // What the setting is now; null until read from GitHub (or when not connected).
  const [saved, setSaved] = useState<T[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSaved(null)
    setError(null)
    if (!repo || !token) return
    let cancelled = false
    getVariable(repo, token, variable)
      .then((v) => !cancelled && setSaved(parseOff(v, ids)))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
    // ids is derived from a constant list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, token, variable])

  const published = parseOff(publishedOff.join(' '), ids)
  const off = saved ?? published
  const pending = saved !== null && formatOff(saved, ids) !== formatOff(published, ids)

  const toggle = async (id: T, on: boolean) => {
    if (!repo || !token || saved === null) return
    const next = on ? saved.filter((s) => s !== id) : [...saved, id]
    const before = saved
    setSaved(next)
    setBusy(true)
    setError(null)
    try {
      await setVariable(repo, token, variable, formatOff(next, ids))
    } catch (e) {
      setSaved(before)
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const footer = !repo
    ? `${schedule} Store switches work on the published site.`
    : !connected
      ? `${schedule} Connect GitHub below to switch stores on or off.`
      : `${schedule} A store that is off isn’t scraped and its prices are hidden.`

  return (
    <div className="space-y-2">
      <Group title={title} action={connected && <RunNow workflow={scrape} />} footer={footer}>
        {stores.map((s) => {
          const isOff = off.includes(s.id)
          const status = storeStatus(runs.get(s.id), isOff, unit)
          return (
            <Row
              key={s.id}
              leading={<HealthDot health={status.health} />}
              title={s.name}
              detail={status.detail}
              trailing={
                <Switch
                  on={!isOff}
                  onChange={(on) => void toggle(s.id, on)}
                  label={`Scrape ${s.name}`}
                  disabled={!connected || saved === null || busy}
                />
              }
            />
          )
        })}
      </Group>
      {error && <Notice tone="warn">{error}</Notice>}
      {pending && !error && <Notice>Saved. The change takes effect on the next run, or tap Run now.</Notice>}
    </div>
  )
}

/** Starts the scrape now instead of waiting for its schedule, and says how it is going. */
function RunNow({ workflow }: { workflow: Scrape }) {
  const { repo, token } = useGithub()
  const [run, setRun] = useState<Run | undefined>()
  const [state, setState] = useState<'idle' | 'starting' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // Follow a run that is already going, and keep checking while it is.
  useEffect(() => {
    if (!repo || !token) return
    let cancelled = false
    const check = () =>
      latestRun(repo, token, workflow)
        .then((r) => !cancelled && setRun(r))
        .catch(() => {})
    void check()
    const timer = setInterval(check, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [repo, token, workflow])

  if (!repo || !token) return null
  const active = isActive(run)

  const start = async () => {
    setState('starting')
    try {
      setRun(await startRun(repo, token, workflow))
      setState('idle')
    } catch (e) {
      setState('error')
      setMessage((e as Error).message)
    }
  }

  if (active || state === 'starting')
    return (
      <a
        href={run?.html_url}
        target="_blank"
        rel="noopener noreferrer"
        title={describeRun(run, workflow)}
        className="flex items-center gap-1.5 pb-0.5 text-[13px] text-info underline-offset-2 hover:underline"
      >
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-info" />
        {run?.status === 'in_progress' ? 'Running' : 'Queued'}
      </a>
    )

  return (
    <Button size="sm" variant="ghost" onClick={start} title={state === 'error' ? message : `Last run ${run ? ago(run.created_at) : 'unknown'}`}>
      <Play aria-hidden size={13} />
      {state === 'error' ? 'Retry' : 'Run now'}
    </Button>
  )
}

/** Saves the GitHub token that the store switches, Run now and the PS5 Refresh use. */
function GithubAccess() {
  const { repo, token } = useGithub()
  const [draft, setDraft] = useState('')

  if (!repo)
    return (
      <Group title="GitHub access">
        <Row title="Not available here" detail="Connecting GitHub works on the published site, where the app knows its repository." />
      </Group>
    )

  if (token)
    return (
      <Group title="GitHub access" footer="The token is stored on this device only.">
        <Row
          leading={<KeyRound aria-hidden size={20} className="text-ok" />}
          title="Connected"
          detail={`${repo.owner}/${repo.name}`}
          trailing={
            <Button size="sm" onClick={() => saveToken(null)}>
              Remove
            </Button>
          }
        />
      </Group>
    )

  return (
    <Group title="GitHub access" footer="The token stays on this device and can only run this repository’s scrapes and change its store settings.">
      <div className="space-y-3 p-4 text-[15px] leading-relaxed">
        <p>Connect GitHub to switch stores on or off, and to start scrapes from the app.</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            Create a{' '}
            <a href={newTokenPage} target="_blank" rel="noopener noreferrer" className="text-info underline-offset-2 hover:underline">
              fine-grained token
            </a>{' '}
            for <b className="font-medium text-ink">{repo.name}</b> only.
          </li>
          <li>
            Under Permissions, set <b className="font-medium text-ink">Actions</b> and <b className="font-medium text-ink">Variables</b> to
            Read and write.
          </li>
          <li>Paste it here.</li>
        </ol>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) {
              saveToken(draft.trim())
              setDraft('')
            }
          }}
        >
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="github_pat_…"
            aria-label="GitHub token"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-full bg-surface-2 px-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-ink/20"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            Save
          </Button>
        </form>
      </div>
    </Group>
  )
}
