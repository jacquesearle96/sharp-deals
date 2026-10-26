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

  it('warns when a claimed discount is just the usual price', () => {
    const v = verdicts(deal({ effectivePrice: 990, savePct: 15, hist: { days: 30, low: 900, high: 1000, usual: 1000 } }))
    expect(v[0]).toMatchObject({ kind: 'warn' })
    expect(v[0].text).toContain('not a real saving')
  })

  it('warns when the was-price was never seen, once tracked for two weeks', () => {
    const d = deal({ wasPrice: 1500, hist: { days: 20, low: 800, high: 1000, usual: 1000 } })
    expect(verdicts(d).some((x) => x.kind === 'warn' && x.text.includes('Never seen above'))).toBe(true)
    expect(verdicts({ ...d, hist: { days: 10, low: 800, high: 1000, usual: 1000 } }).some((x) => x.text.includes('Never seen'))).toBe(false)
  })
})
