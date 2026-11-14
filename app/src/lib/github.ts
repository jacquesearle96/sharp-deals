import { useEffect, useState } from 'react'

/**
 * Talks to GitHub on behalf of the app: starts the scrape workflows and reads or changes which stores they skip.
 *
 * The site is static, so it cannot do either itself. Both need a GitHub token, kept only in this browser's storage
 * (never in the site's code). A fine-grained token limited to this repository with "Actions" and "Variables"
 * (read and write) can do nothing beyond running its workflows and editing its repository variables.
 */

const TOKEN_KEY = 'sharp-deals:github-token'
const TOKEN_EVENT = 'sharp-deals:github-token'
const API = 'https://api.github.com'

export const WORKFLOWS = {
  grocery: 'scrape-and-deploy.yml',
  ps5: 'ps5.yml',
} as const

export type WorkflowId = keyof typeof WORKFLOWS

export interface Repo {
  owner: string
  name: string
}

/**
 * The repository this copy of the app is published from: https://<owner>.github.io/<repo>/ .
 * VITE_GITHUB_REPO ("owner/repo") covers anywhere else, e.g. local development.
 */
export function repoFrom(hostname: string, pathname: string, fallback?: string): Repo | undefined {
  const pages = hostname.match(/^([a-z0-9-]+)\.github\.io$/i)
  const first = pathname.split('/').filter(Boolean)[0]
  if (pages && first) return { owner: pages[1], name: first }
  const m = fallback?.match(/^([\w.-]+)\/([\w.-]+)$/)
  return m ? { owner: m[1], name: m[2] } : undefined
}

export const currentRepo = () => repoFrom(location.hostname, location.pathname, import.meta.env.VITE_GITHUB_REPO)

export const actionsPage = (repo: Repo, workflow: WorkflowId) =>
  `https://github.com/${repo.owner}/${repo.name}/actions/workflows/${WORKFLOWS[workflow]}`

/** Opens GitHub's form for a fine-grained token; the person still picks the repository and permissions there. */
export const newTokenPage = 'https://github.com/settings/personal-access-tokens/new'

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage unavailable (private window): the token simply is not remembered.
  }
  window.dispatchEvent(new Event(TOKEN_EVENT))
}

/** The repository and saved token, kept in step across every screen that uses them. */
export function useGithub() {
  const [repo] = useState(currentRepo)
  const [token, setToken] = useState(loadToken)
  useEffect(() => {
    const sync = () => setToken(loadToken())
    window.addEventListener(TOKEN_EVENT, sync)
    return () => window.removeEventListener(TOKEN_EVENT, sync)
  }, [])
  return { repo, token }
}

export interface Run {
  id: number
  status: 'queued' | 'waiting' | 'pending' | 'requested' | 'in_progress' | 'completed' | string
  conclusion: string | null
  created_at: string
  html_url: string
}

/** What a failed request most likely means, in words the person can act on. */
const PERMISSION = {
  actions: 'The token cannot run workflows on this repository. It needs "Actions: Read and write".',
  variables: 'The token cannot change store settings on this repository. It needs "Variables: Read and write".',
}

async function github<T>(repo: Repo, token: string, path: string, need: keyof typeof PERMISSION, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/repos/${repo.owner}/${repo.name}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  })
  if (res.status === 401) throw new Error('GitHub did not accept the token (it may have expired).')
  if (res.status === 403) throw new Error(PERMISSION[need])
  if (!res.ok) throw Object.assign(new Error(`GitHub answered ${res.status}.`), { status: res.status })
  return (res.status === 204 || res.status === 201 ? undefined : await res.json()) as T
}

const statusOf = (e: unknown) => (e as { status?: number }).status

export async function latestRun(repo: Repo, token: string, workflow: WorkflowId): Promise<Run | undefined> {
  try {
    const data = await github<{ workflow_runs: Run[] }>(repo, token, `/actions/workflows/${WORKFLOWS[workflow]}/runs?per_page=1`, 'actions')
    return data.workflow_runs[0]
  } catch (e) {
    if (statusOf(e) === 404) throw new Error(PERMISSION.actions)
    throw e
  }
}

export const isActive = (run: Run | undefined) => !!run && run.status !== 'completed'

/** Starts a run, unless one is already queued or running (then that one is returned to follow). */
export async function startRun(repo: Repo, token: string, workflow: WorkflowId): Promise<Run | undefined> {
  const current = await latestRun(repo, token, workflow)
  if (isActive(current)) return current
  const before = current?.id
  await github(repo, token, `/actions/workflows/${WORKFLOWS[workflow]}/dispatches`, 'actions', {
    method: 'POST',
    body: JSON.stringify({ ref: 'main' }),
  })
  // The new run takes a moment to appear in the list.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    const run = await latestRun(repo, token, workflow)
    if (run && run.id !== before) return run
  }
  return undefined
}

/** A repository variable's value, or undefined when it has not been created yet. */
export async function getVariable(repo: Repo, token: string, name: string): Promise<string | undefined> {
  try {
    return (await github<{ value: string }>(repo, token, `/actions/variables/${name}`, 'variables')).value
  } catch (e) {
    if (statusOf(e) === 404) return undefined
    throw e
  }
}

/** Sets a repository variable, creating it the first time. */
export async function setVariable(repo: Repo, token: string, name: string, value: string): Promise<void> {
  try {
    await github(repo, token, `/actions/variables/${name}`, 'variables', { method: 'PATCH', body: JSON.stringify({ name, value }) })
    return
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  try {
    await github(repo, token, `/actions/variables`, 'variables', { method: 'POST', body: JSON.stringify({ name, value }) })
  } catch (e) {
    // 404 here means the token cannot see the repository's variables at all.
    throw statusOf(e) === 404 ? new Error(PERMISSION.variables) : e
  }
}

/** A short, plain description of where a run is. */
export function describeRun(run: Run | undefined, workflow: WorkflowId = 'ps5'): string {
  if (!run) return 'Started. Waiting for GitHub to pick it up…'
  switch (run.status) {
    case 'queued':
    case 'waiting':
    case 'pending':
    case 'requested':
      return workflow === 'ps5'
        ? 'Queued. If the grocery scrape is running, this waits for it to finish.'
        : 'Queued. If a PS5 check is running, this waits for it to finish.'
    case 'in_progress':
      return workflow === 'ps5' ? 'Checking all stores now. This usually takes about 5 minutes.' : 'Scraping every store now. This takes about an hour.'
    case 'completed':
      return run.conclusion === 'success' || run.conclusion === 'failure'
        ? 'Finished. Loading the new prices…'
        : `The run ended (${run.conclusion ?? 'unknown'}).`
    default:
      return run.status
  }
}
