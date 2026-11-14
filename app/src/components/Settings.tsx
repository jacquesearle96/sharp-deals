import { Gamepad2, KeyRound, Monitor, Moon, PanelBottom, Play, ShoppingCart, Sun, Users } from 'lucide-react'
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
import { SharePanel, shareSummary } from './ShareList.tsx'
import { Button, Card, Group, HealthDot, IconTile, NavRow, Notice, Row, Segmented, Sheet, Switch } from './ui.tsx'

export type SettingsPage = 'main' | 'toolbar' | 'grocery' | 'ps5' | 'github'

/** Titles for the header when a sub-page is open. */
export const SETTINGS_TITLES: Record<SettingsPage, string> = {
  main: 'Settings',
  toolbar: 'Customise toolbar',
  grocery: 'Grocery & baby stores',
  ps5: 'PS5 stores',
  github: 'GitHub access',
}

interface Props {
  page: SettingsPage
  onPage: (page: SettingsPage) => void
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

const GROCERY_STORES = DEAL_STORES.map((id) => ({ id, name: STORE_INFO[id].name }))
const PS5_STORE_LIST = (Object.keys(PS5_STORES) as Ps5StoreId[]).map((id) => ({ id, name: PS5_STORES[id] }))

export function Settings({ page, onPage, theme, onTheme, hiddenTabs, onToggleTab, list, deals }: Props) {
  const ps5 = usePs5Feed()
  const { repo, token } = useGithub()
  const [sharing, setSharing] = useState(false)
  const groceryRuns = new Map<string, RunLike>((deals.status === 'ready' ? deals.index.runs : []).map((r) => [r.store, r]))
  const ps5Runs = new Map<string, RunLike>((ps5.state.status === 'ready' ? ps5.state.feed.runs : []).map((r) => [r.store, r]))
  const groceryOff = deals.status === 'ready' ? (deals.index.off ?? []) : []
  const ps5Off = ps5.state.status === 'ready' ? (ps5.state.feed.off ?? []) : []

  if (page === 'grocery')
    return (
      <SubPage>
        <StoreSwitches
          scrape="grocery"
          schedule="Scraped every 6 hours."
          stores={GROCERY_STORES}
          runs={groceryRuns}
          publishedOff={groceryOff}
          unit={['deal', 'deals']}
          onConnect={() => onPage('github')}
        />
      </SubPage>
    )
  if (page === 'ps5')
    return (
      <SubPage>
        <StoreSwitches
          scrape="ps5"
          schedule="Checked every hour during November."
          stores={PS5_STORE_LIST}
          runs={ps5Runs}
          publishedOff={ps5Off}
          unit={['console', 'consoles']}
          onConnect={() => onPage('github')}
        />
      </SubPage>
    )
  if (page === 'toolbar')
    return (
      <SubPage>
        <Group title="Tabs" footer="Choose which tabs appear in the toolbar. Settings is always there.">
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
      </SubPage>
    )
  if (page === 'github')
    return (
      <SubPage>
        <GithubAccess />
      </SubPage>
    )

  const share = shareSummary(list.household, list.status, list.canShare)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Group title="Appearance">
        <div className="p-2">
          <Segmented label="Theme (Auto follows your phone’s setting)" options={THEMES} value={theme} onChange={onTheme} />
        </div>
      </Group>

      <Group title="General">
        <NavRow
          leading={
            <IconTile className="bg-brand-soft text-brand">
              <PanelBottom aria-hidden size={17} />
            </IconTile>
          }
          title="Customise toolbar"
          value={`${HIDEABLE_TABS.length - hiddenTabs.length} of ${HIDEABLE_TABS.length} tabs`}
          onClick={() => onPage('toolbar')}
        />
        <NavRow
          leading={
            <IconTile className="bg-info-soft text-info">
              <Users aria-hidden size={17} />
            </IconTile>
          }
          title="Shared list"
          detail={list.canShare ? undefined : 'Needs a Supabase project, see supabase/README.md'}
          value={<span className={share.tone === 'ok' ? 'text-ok' : share.tone === 'warn' ? 'text-warn' : undefined}>{share.text}</span>}
          onClick={() => setSharing(true)}
          disabled={!list.canShare}
        />
      </Group>

      <Group title="Stores & data">
        <NavRow
          leading={
            <IconTile className="bg-ok-soft text-ok">
              <ShoppingCart aria-hidden size={17} />
            </IconTile>
          }
          title="Grocery & baby stores"
          detail={<StoresSummary stores={GROCERY_STORES} runs={groceryRuns} off={groceryOff} />}
          onClick={() => onPage('grocery')}
        />
        <NavRow
          leading={
            <IconTile className="bg-info-soft text-info">
              <Gamepad2 aria-hidden size={17} />
            </IconTile>
          }
          title="PS5 stores"
          detail={<StoresSummary stores={PS5_STORE_LIST} runs={ps5Runs} off={ps5Off} />}
          onClick={() => onPage('ps5')}
        />
        <NavRow
          leading={
            <IconTile className="bg-surface-2 text-ink">
              <KeyRound aria-hidden size={17} />
            </IconTile>
          }
          title="GitHub access"
          detail="Needed to switch stores on or off"
          value={repo && token ? <span className="text-ok">Connected</span> : 'Not connected'}
          onClick={() => onPage('github')}
        />
      </Group>

      <Sheet open={sharing} onClose={() => setSharing(false)} title="Shared list">
        <SharePanel household={list.household} status={list.status} onStart={list.startSharing} onJoin={list.join} onLeave={list.leave} />
      </Sheet>
    </div>
  )
}

function SubPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-2xl space-y-8">{children}</div>
}

/** "All 9 up to date", or how many need attention and how many are off. */
function StoresSummary({ stores, runs, off }: { stores: { id: string }[]; runs: Map<string, RunLike>; off: string[] }) {
  const statuses = stores.map((s) => storeStatus(runs.get(s.id), off.includes(s.id), ['', '']).health)
  const failing = statuses.filter((h) => h === 'failing').length
  const offCount = statuses.filter((h) => h === 'off').length
  if (runs.size === 0) return <>Loading…</>
  if (!failing && !offCount) return <>All {stores.length} up to date</>
  return (
    <>
      {failing > 0 && <span className="text-warn">{failing} need{failing === 1 ? 's' : ''} attention</span>}
      {failing > 0 && offCount > 0 && ' · '}
      {offCount > 0 && `${offCount} off`}
    </>
  )
}

/**
 * One scrape's stores: how each did on its latest run, and a switch to stop scraping it. The switches edit a GitHub
 * repository variable the workflow reads, so they need the token from "GitHub access" below.
 */
function StoreSwitches<T extends StoreId | Ps5StoreId>({
  scrape,
  schedule,
  stores,
  runs,
  publishedOff,
  unit,
  onConnect,
}: {
  scrape: Scrape
  schedule: string
  stores: { id: T; name: string }[]
  runs: Map<string, RunLike>
  /** Stores the latest published data was built without */
  publishedOff: string[]
  unit: [string, string]
  /** Opens GitHub access */
  onConnect: () => void
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
    : `${schedule} A store that is off isn’t scraped and its prices are hidden.`

  return (
    <div className="space-y-2">
      {repo && !connected && (
        <Card className="mb-6 overflow-hidden">
          <NavRow
            leading={
              <IconTile className="bg-surface-2 text-ink">
                <KeyRound aria-hidden size={17} />
              </IconTile>
            }
            title="Connect GitHub"
            detail="To switch stores on or off and run scrapes from here"
            onClick={onConnect}
          />
        </Card>
      )}
      <Group title="Stores" action={connected && <RunNow workflow={scrape} />} footer={footer}>
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
      <Group title="Token">
        <Row title="Not available here" detail="Connecting GitHub works on the published site, where the app knows its repository." />
      </Group>
    )

  if (token)
    return (
      <Group title="Token" footer="The token is stored on this device only.">
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
    <Group title="Token" footer="The token stays on this device and can only run this repository’s scrapes and change its store settings.">
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
