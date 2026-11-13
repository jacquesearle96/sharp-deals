/**
 * TEMPORARY (Black Friday 2026): starts the PS5 price workflow from the app.
 *
 * The site is static, so it cannot read the stores itself. Instead it asks GitHub to run .github/workflows/ps5.yml.
 * That needs a GitHub token, which is kept only in this browser's storage (never in the site's code): a fine-grained
 * token limited to this repository with "Actions: read and write" can do nothing beyond starting and reading workflow runs.
 */

const TOKEN_KEY = 'sharp-deals:github-token'
const WORKFLOW = 'ps5.yml'
const API = 'https://api.github.com'

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

export const actionsPage = (repo: Repo) => `https://github.com/${repo.owner}/${repo.name}/actions/workflows/${WORKFLOW}`

/** Opens GitHub's form for a fine-grained token; the person still picks the repository and permission there. */
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
}

export interface Run {
  id: number
  status: 'queued' | 'waiting' | 'pending' | 'requested' | 'in_progress' | 'completed' | string
  conclusion: string | null
  created_at: string
  html_url: string
}

async function github<T>(repo: Repo, token: string, path: string, init: RequestInit = {}): Promise<T> {
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
  if (res.status === 403 || res.status === 404)
    throw new Error('The token cannot run workflows on this repository. It needs "Actions: read and write" on it.')
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`)
  return (res.status === 204 ? undefined : await res.json()) as T
}

export async function latestRun(repo: Repo, token: string): Promise<Run | undefined> {
  const data = await github<{ workflow_runs: Run[] }>(repo, token, `/actions/workflows/${WORKFLOW}/runs?per_page=1`)
  return data.workflow_runs[0]
}

export const isActive = (run: Run | undefined) => !!run && run.status !== 'completed'

/** Starts a run, unless one is already queued or running (then that one is returned to follow). */
export async function startRun(repo: Repo, token: string): Promise<Run | undefined> {
  const current = await latestRun(repo, token)
  if (isActive(current)) return current
  const before = current?.id
  await github(repo, token, `/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main' }),
  })
  // The new run takes a moment to appear in the list.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    const run = await latestRun(repo, token)
    if (run && run.id !== before) return run
  }
  return undefined
}

/** A short, plain description of where a run is. */
export function describeRun(run: Run | undefined): string {
  if (!run) return 'Started. Waiting for GitHub to pick it up…'
  switch (run.status) {
    case 'queued':
    case 'waiting':
    case 'pending':
    case 'requested':
      return 'Queued. If the main deals scrape is running, this waits for it to finish.'
    case 'in_progress':
      return 'Checking all stores now. This usually takes about 5 minutes.'
    case 'completed':
      return run.conclusion === 'success' || run.conclusion === 'failure'
        ? 'Finished. Loading the new prices…'
        : `The run ended (${run.conclusion ?? 'unknown'}).`
    default:
      return run.status
  }
}
