import { describe, expect, it } from 'vitest'
import { failureReason, storeStatus } from './status.ts'

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
