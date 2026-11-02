import { describe, expect, it } from 'vitest'
import { parsePromo } from '../../../shared/promo.ts'
import type { DealProduct } from '../../../shared/types.ts'
import { verdicts } from './verdict.ts'

const deal = (over: Partial<DealProduct> = {}): DealProduct => ({
  store: 'babycity',
  id: 'a',
  name: 'Baby Monitor',
  price: 800,
  promo: parsePromo(''),
  effectivePrice: 800,
  category: 'baby',
  savePct: 20,
  ...over,
})

describe('verdicts', () => {
  it('says nothing without enough history', () => {
    expect(verdicts(deal())).toEqual([])
    expect(verdicts(deal({ hist: { days: 3, low: 800, high: 1000, usual: 1000 } }))).toEqual([])
  })

  it('flags the lowest price seen when the price has moved before', () => {
    const v = verdicts(deal({ hist: { days: 20, low: 800, high: 1000, usual: 1000 } }))
    expect(v[0]).toEqual({ kind: 'good', text: 'Lowest in 20 days' })
  })

  it('does not call a never-changing price the lowest', () => {
    expect(verdicts(deal({ savePct: 0, hist: { days: 20, low: 800, high: 800, usual: 800 } }))).toEqual([])
  })

  it('flags a price well under the usual one', () => {
    const v = verdicts(deal({ effectivePrice: 900, hist: { days: 20, low: 850, high: 1000, usual: 1000 } }))
    expect(v[0]).toMatchObject({ kind: 'good' })
    expect(v[0].text).toContain('usual')
  })

  it('does not call a special fake just because it is all we have seen', () => {
    // Tracked for a week, always at the special price: the normal price is simply unknown.
    expect(verdicts(deal({ effectivePrice: 990, savePct: 15, hist: { days: 8, low: 990, high: 990, usual: 990, steady: 8 } }))).toEqual([])
    expect(verdicts(deal({ effectivePrice: 990, savePct: 15, hist: { days: 30, low: 990, high: 990, usual: 990, steady: 30 } }))).toEqual([])
  })

  it('warns when the product was seen at this price with no special on', () => {
    const v = verdicts(deal({ effectivePrice: 990, savePct: 15, hist: { days: 30, low: 900, high: 1000, usual: 1000, regular: 990, steady: 5 } }))
    expect(v[0]).toMatchObject({ kind: 'warn' })
    expect(v[0].text).toBe('R990.00 with no special on, not a real saving')
  })

  it('warns when the "special" has held for many weeks', () => {
    const v = verdicts(deal({ effectivePrice: 990, savePct: 15, hist: { days: 50, low: 990, high: 990, usual: 990, steady: 50 } }))
    expect(v).toEqual([{ kind: 'warn', text: 'Same price for 7 weeks, not a real saving' }])
  })

  it('only doubts a was-price against prices seen with no special on', () => {
    const d = deal({ wasPrice: 1500, hist: { days: 20, low: 800, high: 1000, usual: 1000 } })
    expect(verdicts(d).some((x) => x.text.includes('Never seen above'))).toBe(false)
    const seen = { ...d, hist: { days: 20, low: 800, high: 1000, usual: 1000, regularHigh: 1000 } }
    expect(verdicts(seen).some((x) => x.kind === 'warn' && x.text.includes('Never seen above R1')) ).toBe(true)
    expect(verdicts({ ...seen, hist: { ...seen.hist, days: 10 } }).some((x) => x.text.includes('Never seen'))).toBe(false)
  })
})
