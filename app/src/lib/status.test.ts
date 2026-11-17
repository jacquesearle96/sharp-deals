import { describe, expect, it } from 'vitest'
import { failureReason, staleStores, storeStatus } from './status.ts'

const now = new Date('2026-11-14T08:00:00Z')
const unit: [string, string] = ['deal', 'deals']

describe('storeStatus', () => {
  it('shows the count and age of a healthy store', () => {
    expect(storeStatus({ ok: true, count: 10922, at: '2026-11-14T07:00:00Z' }, false, unit, now)).toEqual({
      health: 'ok',
      detail: `${(10922).toLocaleString('en-ZA')} deals · updated 1 h ago`,
    })
  })
  it('explains a failed run and how old the data on show is', () => {
    const run = { ok: true, count: 441, at: '2026-11-12T08:00:00Z', error: 'Error: adapter returned no products', notes: ['title "Just a moment..."'] }
    expect(storeStatus(run, false, unit, now)).toEqual({ health: 'failing', detail: 'Blocked by the site’s bot check · showing data from 2 d ago' })
  })
  it('says when a store is switched off', () => {
    expect(storeStatus(undefined, true, unit, now).health).toBe('off')
  })
})

describe('failureReason', () => {
  it('recognises the common causes', () => {
    expect(failureReason({ error: 'Error: page.evaluate: Error: 400 from PnP search' })).toMatch(/search returned an error/)
    expect(failureReason({ notes: ['Sorry, you have been blocked'] })).toMatch(/bot check/)
    expect(failureReason({ error: 'Error: no PS5 consoles found (the page layout may have changed)' })).toBe('No products found')
    expect(failureReason({ error: 'weird' })).toBe('Latest run failed')
  })
})

describe('staleStores', () => {
  const blocked = { ok: true, count: 1742, at: '2026-11-12T07:31:00Z', error: 'Error: adapter returned no products' }
  it('lists stores whose last good data is over a day old', () => {
    const runs = [
      { store: 'checkers', ...blocked },
      { store: 'pnp', ok: true, count: 10962, at: '2026-11-14T07:00:00Z' },
      // Failed once, but its data is only a few hours old.
      { store: 'clicks', ok: true, count: 945, at: '2026-11-14T02:00:00Z', error: 'Error: timeout' },
    ]
    expect([...staleStores(runs, [], now)]).toEqual([['checkers', '2026-11-12T07:31:00Z']])
  })
  it('also lists a store that simply stopped being scraped', () => {
    expect([...staleStores([{ store: 'foodlovers', ok: true, count: 113, at: '2026-11-12T17:00:00Z' }], [], now).keys()]).toEqual(['foodlovers'])
  })
  it('ignores switched-off stores', () => {
    expect(staleStores([{ store: 'checkers', ...blocked }], ['checkers'], now).size).toBe(0)
  })
})
