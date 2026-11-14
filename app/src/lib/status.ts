import { ago } from './format.ts'

/** What the scrapers record for one store; grocery and PS5 runs share these fields. */
export interface RunLike {
  ok: boolean
  count: number
  /** Last successful run */
  at?: string
  /** Why the latest attempt failed, when it did */
  error?: string
  notes?: string[]
}

export type Health = 'ok' | 'failing' | 'off'

export interface StoreStatus {
  health: Health
  /** One line for under the store name */
  detail: string
}

/** Turns a run record into words: how fresh the data is and, if the latest attempt failed, why. */
export function storeStatus(run: RunLike | undefined, off: boolean, unit: [string, string], now = new Date()): StoreStatus {
  const count = run && run.count > 0 ? `${run.count.toLocaleString('en-ZA')} ${run.count === 1 ? unit[0] : unit[1]}` : undefined
  if (off) return { health: 'off', detail: 'Switched off · not scraped' }
  if (!run) return { health: 'failing', detail: 'Not scraped yet' }
  const age = run.at ? ago(run.at, now) : undefined
  if (run.ok && !run.error) return { health: 'ok', detail: [count, age && `updated ${age}`].filter(Boolean).join(' · ') }
  const kept = age ? `showing data from ${age}` : 'no data yet'
  return { health: 'failing', detail: `${failureReason(run)} · ${kept}` }
}

/** The likeliest cause of a failed run, from its error and notes. */
export function failureReason(run: Pick<RunLike, 'error' | 'notes'>): string {
  const text = [run.error, ...(run.notes ?? [])].join(' ')
  if (/just a moment|security verification|cloudflare|you have been blocked|attention required|captcha|access denied|\b403\b/i.test(text))
    return 'Blocked by the site’s bot check'
  if (/\b(400|429|5\d\d) from\b|answered (4|5)\d\d/i.test(text)) return 'The site’s search returned an error'
  if (/timeout|timed out|net::|ECONN|ENOTFOUND/i.test(text)) return 'The site didn’t respond'
  if (/no products|no .*found|layout may have changed/i.test(text)) return 'No products found'
  return 'Latest run failed'
}
