import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePromo } from '../../../shared/promo.ts'
import type { DealProduct } from '../../../shared/types.ts'
import { deleteItem, fetchList, formatCode, newHouseholdCode, normalizeCode, putItem, syncConfig } from './sync.ts'

const CFG = { url: 'https://abc.supabase.co', anonKey: 'anon-key' }
const deal: DealProduct = {
  store: 'babycity',
  id: 'monitor-1',
  name: 'Baby Monitor',
  price: 800,
  promo: parsePromo(''),
  effectivePrice: 800,
  category: 'baby',
  savePct: 0,
}

afterEach(() => vi.unstubAllGlobals())

describe('syncConfig', () => {
  it('is null until both values are set', () => {
    expect(syncConfig({})).toBeNull()
    expect(syncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
  })
  it('trims a trailing slash from the URL', () => {
    expect(syncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'https://x.supabase.co', anonKey: 'k' })
  })
})

describe('household codes', () => {
  it('makes 12 readable characters', () => {
    const code = newHouseholdCode()
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{12}$/)
  })
  it('makes different codes each time', () => {
    expect(newHouseholdCode()).not.toBe(newHouseholdCode())
  })
  it('accepts dashes, spaces and lower case', () => {
    expect(normalizeCode('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN')
    expect(normalizeCode('ABCD EFGH JKMN')).toBe('ABCDEFGHJKMN')
  })
  it('rejects the wrong length or look-alike characters', () => {
    expect(normalizeCode('ABCD')).toBeNull()
    expect(normalizeCode('ABCDEFGHJKM0')).toBeNull()
  })
  it('formats in groups of four', () => {
    expect(formatCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN')
  })
})

describe('list calls', () => {
  it('fetchList posts the household and returns the products', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify([{ item_key: 'babycity:monitor-1', product: deal }]) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchList(CFG, 'ABCDEFGHJKMN')).toEqual([deal])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://abc.supabase.co/rest/v1/rpc/get_list')
    expect(JSON.parse(init.body)).toEqual({ h: 'ABCDEFGHJKMN' })
    expect(init.headers.apikey).toBe('anon-key')
  })

  it('sends a publishable key in apikey only, and a legacy JWT key in both headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '[]' })
    vi.stubGlobal('fetch', fetchMock)
    await fetchList({ url: CFG.url, anonKey: 'sb_publishable_abc' }, 'ABCDEFGHJKMN')
    await fetchList({ url: CFG.url, anonKey: 'eyJhbGciOi.payload.sig' }, 'ABCDEFGHJKMN')
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ apikey: 'sb_publishable_abc', 'Content-Type': 'application/json' })
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer eyJhbGciOi.payload.sig')
  })

  it('putItem and deleteItem use the store:id key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
    await putItem(CFG, 'ABCDEFGHJKMN', deal)
    await deleteItem(CFG, 'ABCDEFGHJKMN', deal)
    expect(fetchMock.mock.calls[0][0]).toContain('/rpc/put_item')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ h: 'ABCDEFGHJKMN', k: 'babycity:monitor-1', p: { id: 'monitor-1' } })
    expect(fetchMock.mock.calls[1][0]).toContain('/rpc/del_item')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ h: 'ABCDEFGHJKMN', k: 'babycity:monitor-1' })
  })

  it('throws on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' }))
    await expect(fetchList(CFG, 'ABCDEFGHJKMN')).rejects.toThrow('Sync failed (401)')
  })
})
