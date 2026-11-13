import { describe, expect, it } from 'vitest'
import { isPs5Console, modelOf, sortOffers, type Ps5Offer } from './ps5.ts'

describe('isPs5Console', () => {
  it.each([
    ['PS5® Slim Disc Edition (E) 1TB', 15499],
    ['Sony PlayStation 5 Digital Edition Console – 825GB SSD', 14499],
    ['PlayStation 5 Slim Console with disc drive (PS5 Slim)', 15899],
    ['Sony PlayStation 5 - Standard Console (E)', 15499],
    ['PLAYSTATION SPORTS VOUCH BUNDLE CFI 1116', 12999],
    ['CtrlAltDel Horror Bundle | PS5 Disc Console + 3 Games', 20579],
    ['Playstation 5 Pro 2TB', 24493],
  ])('keeps the console %s', (name, price) => {
    expect(isPs5Console(name, price)).toBe(true)
  })

  it.each([
    ['PS5 DualSense Wireless Controller', 1899],
    ['Disc Drive For PS5 Digital Edition Consoles', 2898],
    ['PlayStation VR2 + VR2 Charging Station', 12999],
    ['PlayStation Portal Remote Player', 5799],
    ['PS5 Digital Edition Gaming Console + Dualsense Controller - Pre-owned', 11499],
    ['Playstation 5 Hard Disc Drive - WD Black SN850P NVME SSD Harddrive - 2TB', 10999],
    ['PLAYSTATION 4 500GB SLIM + DS4 BLACK', 7999],
    ['Logitech G923 Trueforce Racing Wheel and Pedals Set for PC/PS4/PS5', 7499],
    ['Xbox Series X', 17999],
  ])('drops %s', (name, price) => {
    expect(isPs5Console(name, price)).toBe(false)
  })
})

describe('sortOffers', () => {
  it('puts the cheapest first, and in-stock before out-of-stock at the same price', () => {
    const o = (store: Ps5Offer['store'], price: number, inStock?: boolean): Ps5Offer => ({ store, name: 'PS5', price, url: store, inStock })
    const sorted = sortOffers([o('game', 15499, false), o('makro', 14499), o('takealot', 15499, true)])
    expect(sorted.map((x) => x.store)).toEqual(['makro', 'takealot', 'game'])
  })
})

describe('modelOf', () => {
  it('reads the model from the name', () => {
    expect(modelOf('PS5® Pro A Console')).toBe('pro')
    expect(modelOf('PLAYSTATION PS5 SLIM DIG+DS5 W+DS CHARG STATN')).toBe('digital')
    expect(modelOf('PS5® Slim Disc Edition (E) 1TB')).toBe('disc')
  })
})
