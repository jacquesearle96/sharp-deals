import { describe, expect, it } from 'vitest'
import { isConsole, modelOf, sortOffers, type Ps5Offer } from './ps5.ts'

describe('isConsole', () => {
  it.each([
    ['PS5® Slim Disc Edition (E) 1TB', 15499],
    ['Sony PlayStation 5 Digital Edition Console – 825GB SSD', 14499],
    ['PlayStation 5 Slim Console with disc drive (PS5 Slim)', 15899],
    ['Sony PlayStation 5 - Standard Console (E)', 15499],
    ['PLAYSTATION SPORTS VOUCH BUNDLE CFI 1116', 12999],
    ['CtrlAltDel Horror Bundle | PS5 Disc Console + 3 Games', 20579],
    ['Playstation 5 Pro 2TB', 24493],
    ['Xbox Series X', 17999],
    ['Xbox SERIES S 512 GB', 9999],
    ['Microsoft Xbox Series S 1TB Console - Carbon Black', 13999],
    ['XBOX SERIES X 1TB DIGITAL EDITION', 15999],
  ])('keeps the console %s', (name, price) => {
    expect(isConsole(name, price)).toBe(true)
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
    ['Seagate Storage Expansion Card for Xbox Series X|S 2TB', 6999],
    ['Xbox Series X Wireless Controller - Carbon Black', 1699],
    ['ROG Xbox Ally X Ryzen Z2 Extreme 24GB RAM 1TB SSD', 19999],
    ['Xbox One S 1TB Console', 6499],
    ['Logitech G923 Racing Wheel for Xbox Series X|S and PC', 7499],
  ])('drops %s', (name, price) => {
    expect(isConsole(name, price)).toBe(false)
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
    expect(modelOf('PS5® Pro A Console')).toBe('ps5-pro')
    expect(modelOf('PLAYSTATION PS5 SLIM DIG+DS5 W+DS CHARG STATN')).toBe('ps5-digital')
    expect(modelOf('PS5® Slim Disc Edition (E) 1TB')).toBe('ps5-disc')
    expect(modelOf('Xbox SERIES S 512 GB')).toBe('series-s')
    expect(modelOf('XBOX SERIES X 1TB DIGITAL EDITION')).toBe('series-x')
  })
})
