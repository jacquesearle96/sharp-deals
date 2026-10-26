import { describe, expect, it } from 'vitest'
import { parsePromo } from '../../../shared/promo.ts'
import type { DealProduct } from '../../../shared/types.ts'
import { buildSearch, queryDeals, type Filters } from './query.ts'

const deal = (over: Partial<DealProduct> & Pick<DealProduct, 'id' | 'name'>): DealProduct => ({
  store: 'pnp',
  price: 50,
  promo: parsePromo(''),
  effectivePrice: 50,
  category: 'grocery',
  savePct: 0,
  ...over,
})

const DEALS: DealProduct[] = [
  deal({ id: '1', name: 'Lindt Lindor Milk Chocolate 75g', store: 'woolworths', price: 94.99, promo: parsePromo('Buy any 3 for 2'), effectivePrice: 63.33, savePct: 33 }),
  deal({ id: '2', name: 'Cadbury Dairy Milk Slab 80g', store: 'pnp', price: 24.99, promo: parsePromo('2 For R38.00'), effectivePrice: 19, savePct: 24 }),
  deal({ id: '3', name: 'Clover Full Cream Milk 2L', store: 'checkers', price: 38.99, wasPrice: 44.99, effectivePrice: 38.99, savePct: 13 }),
  deal({ id: '4', name: 'Nescafe Gold 200g', store: 'spar', price: 149.99, wasPrice: 194.99, effectivePrice: 149.99, savePct: 23, promoEnds: '2026-12-07' }),
]
const mini = buildSearch(DEALS)
const base: Filters = { text: '', stores: [], multiBuyOnly: false, sort: 'relevance' }
const ids = (f: Partial<Filters>) => queryDeals(DEALS, mini, { ...base, ...f }).map((d) => d.id)

describe('queryDeals', () => {
  it('without text, relevance means biggest saving first', () => {
    expect(ids({})).toEqual(['1', '2', '4', '3'])
  })
  it('finds products by prefix and ignores case', () => {
    expect(ids({ text: 'choc' }).sort()).toEqual(['1'])
    expect(ids({ text: 'MILK' }).sort()).toEqual(['1', '2', '3'])
  })
  it('requires every word to match', () => {
    expect(ids({ text: 'milk cream' })).toEqual(['3'])
  })
  it('tolerates a small typo', () => {
    expect(ids({ text: 'nescfe' })).toEqual(['4'])
  })
  it('filters by store', () => {
    expect(ids({ stores: ['spar', 'checkers'] }).sort()).toEqual(['3', '4'])
  })
  it('keeps only multi-buys when asked, ignoring plain discounts', () => {
    expect(ids({ multiBuyOnly: true }).sort()).toEqual(['1', '2'])
  })
  it('keeps only discounted or multi-buy items when onSaleOnly is set', () => {
    const plain = deal({ id: '5', name: 'Plain Cot Sheet', store: 'pnp', price: 120, effectivePrice: 120, savePct: 0 })
    const all = [...DEALS, plain]
    const hits = queryDeals(all, buildSearch(all), { ...base, onSaleOnly: true }).map((d) => d.id)
    expect(hits).not.toContain('5')
    expect(hits).toHaveLength(4)
    expect(queryDeals(all, buildSearch(all), base).map((d) => d.id)).toContain('5')
  })
  it('sorts by lowest effective price', () => {
    expect(ids({ sort: 'price' })).toEqual(['2', '3', '1', '4'])
  })
  it('sorts ending-soon first, with unknown end dates last', () => {
    expect(ids({ sort: 'ending' })[0]).toBe('4')
  })
})
