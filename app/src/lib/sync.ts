import type { DealProduct } from '../../../shared/types.ts'

/**
 * Shared list backend: three Supabase database functions (see supabase/schema.sql).
 * The app talks to them over plain fetch, so there is no SDK to bundle.
 */
export interface SyncConfig {
  url: string
  anonKey: string
}

export function syncConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string } = import.meta.env): SyncConfig | null {
  const url = env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

// No 0/O/1/I/L: easier to read out loud or type from a screenshot.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A random 12-character code. About 60 bits, so it cannot be guessed. */
export function newHouseholdCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(12), (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Accepts "abcd-efgh-jkmn", "ABCD EFGH JKMN" etc.; returns the clean code or null. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return code.length === 12 && [...code].every((c) => ALPHABET.includes(c)) ? code : null
}

export const formatCode = (code: string) => code.replace(/(.{4})(?=.)/g, '$1-')

export const itemKey = (p: Pick<DealProduct, 'store' | 'id'>) => `${p.store}:${p.id}`

async function rpc<T>(cfg: SyncConfig, fn: string, args: Record<string, unknown>): Promise<T> {
  // Legacy anon keys are JWTs and also go in Authorization. The newer sb_publishable_ keys are not
  // JWTs and are sent in the apikey header only.
  const headers: Record<string, string> = { apikey: cfg.anonKey, 'Content-Type': 'application/json' }
  if (cfg.anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.anonKey}`
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) })
  if (!res.ok) throw new Error(`Sync failed (${res.status})`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function fetchList(cfg: SyncConfig, household: string): Promise<DealProduct[]> {
  const rows = await rpc<{ item_key: string; product: DealProduct }[]>(cfg, 'get_list', { h: household })
  return rows.map((r) => r.product)
}

export const putItem = (cfg: SyncConfig, household: string, p: DealProduct) =>
  rpc<void>(cfg, 'put_item', { h: household, k: itemKey(p), p })

export const deleteItem = (cfg: SyncConfig, household: string, p: Pick<DealProduct, 'store' | 'id'>) =>
  rpc<void>(cfg, 'del_item', { h: household, k: itemKey(p) })
