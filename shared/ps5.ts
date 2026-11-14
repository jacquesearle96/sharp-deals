/**
 * TEMPORARY (Black Friday 2026): PlayStation 5 console prices from South African stores.
 * Everything PS5-related lives in shared/ps5.ts, scraper/src/ps5/, app/src/components/Ps5Deals.tsx
 * and .github/workflows/ps5.yml, so it can be deleted in one go afterwards.
 */

export const PS5_STORES = {
  takealot: 'Takealot',
  amazon: 'Amazon.co.za',
  game: 'Game',
  makro: 'Makro',
  incredible: 'Incredible',
  hificorp: 'HiFi Corp',
  btgames: 'BT Games',
  loot: 'Loot',
  houseandhome: 'House & Home',
  okfurniture: 'OK Furniture',
  computermania: 'Computer Mania',
} as const

export type Ps5StoreId = keyof typeof PS5_STORES

export interface Ps5Offer {
  store: Ps5StoreId
  name: string
  /** Current price in rand */
  price: number
  /** Price before the special, when the store shows one */
  wasPrice?: number
  url: string
  /** false when the store says out of stock or sold out; undefined when it does not say */
  inStock?: boolean
}

export interface Ps5StoreRun {
  store: Ps5StoreId
  ok: boolean
  /** Consoles found on the last successful run */
  count: number
  /** ISO time of the last successful run */
  at?: string
  /** Why the latest attempt failed (the offers shown are then from `at`) */
  error?: string
}

export interface Ps5Feed {
  generatedAt: string
  offers: Ps5Offer[]
  /** Stores switched off in Settings when this was built: not checked, and their consoles left out */
  off?: Ps5StoreId[]
  runs: Ps5StoreRun[]
}

/** Cheapest real console in South Africa is well above this; accessories and games are well below. */
const MIN_PRICE = 7000
const MAX_PRICE = 60000

const PS5 = /\b(?:ps ?5|playstation(?: ?5)?)\b/i

/**
 * Words that mean the listing is not a new PS5 console: other consoles, add-ons that cost as much as one
 * (VR2, Portal, racing wheels), second-hand stock, and cosmetic extras.
 */
const NOT_A_CONSOLE =
  /\b(?:ps ?[1-4]|playstation ?[1-4]|vr ?2?|portal|remote player|pre[- ]?owned|refurbished|renewed|used|second[- ]?hand|skin|decal|cover|stand|wheel|pedals?|headset|monitor|tv|chair|desk|xbox|switch|steam deck|nvme|hard ?(?:dis[ck] )?drive|harddrive)\b/i

/** Whether a listing looks like a new PS5 console (alone or in a bundle) rather than a game or accessory. */
export function isPs5Console(name: string, price: number): boolean {
  if (!(price >= MIN_PRICE && price <= MAX_PRICE)) return false
  const clean = name.replace(/[®™]/g, '')
  return PS5.test(clean) && !NOT_A_CONSOLE.test(clean)
}

/** Cheapest first; in-stock offers before out-of-stock ones at the same price. */
export function sortOffers(offers: Ps5Offer[]): Ps5Offer[] {
  return [...offers].sort((a, b) => a.price - b.price || Number(b.inStock !== false) - Number(a.inStock !== false))
}

export type Ps5Model = 'digital' | 'disc' | 'pro'

/** Best guess at the model from the listing name; stores word these inconsistently. */
export function modelOf(name: string): Ps5Model {
  if (/\bpro\b/i.test(name)) return 'pro'
  if (/digital|\bdig\b/i.test(name)) return 'digital'
  return 'disc'
}
