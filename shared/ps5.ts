/**
 * TEMPORARY (Black Friday 2026): PS5 and Xbox Series S/X console prices from South African stores
 * (shown on the Consoles tab; the code keeps its original "ps5" names).
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

/** The cheapest real consoles in South Africa are well above these; accessories and games are well below. */
const MIN_PRICE = { ps5: 7000, xbox: 6000 }
const MAX_PRICE = 60000

const PS5 = /\b(?:ps ?5|playstation(?: ?5)?)\b/i
const XBOX_SERIES = /\bxbox\b.*\bseries ?[sx]\b|\bseries ?[sx]\b.*\bxbox\b/i

/**
 * Words that mean the listing is not a new console: add-ons that cost as much as one (VR2, Portal, racing wheels,
 * storage), second-hand stock, cosmetic extras, and accessories "compatible with" a console.
 */
const NOT_A_CONSOLE =
  /\b(?:vr ?2?|portal|remote player|pre[- ]?owned|refurbished|renewed|used|second[- ]?hand|skin|decal|cover|stand|wheel|pedals?|headset|monitor|tv|chair|desk|steam deck|nvme|hard ?(?:dis[ck] )?drive|harddrive|compatible|expansion|storage card)\b/i
/** Other consoles named in a PS5 listing, and vice versa. */
const OTHER_THAN_PS5 = /\b(?:ps ?[1-4]|playstation ?[1-4]|xbox|switch)\b/i
const OTHER_THAN_XBOX = /\b(?:xbox one|xbox 360|ally|switch|ps ?\d|playstation)\b/i

/** Whether a listing looks like a new PS5 or Xbox Series S/X console (alone or in a bundle), not a game or accessory. */
export function isConsole(name: string, price: number): boolean {
  if (!(price <= MAX_PRICE)) return false
  const clean = name.replace(/[®™]/g, '')
  if (NOT_A_CONSOLE.test(clean)) return false
  if (XBOX_SERIES.test(clean)) return price >= MIN_PRICE.xbox && !OTHER_THAN_XBOX.test(clean)
  return price >= MIN_PRICE.ps5 && PS5.test(clean) && !OTHER_THAN_PS5.test(clean)
}

/** Cheapest first; in-stock offers before out-of-stock ones at the same price. */
export function sortOffers(offers: Ps5Offer[]): Ps5Offer[] {
  return [...offers].sort((a, b) => a.price - b.price || Number(b.inStock !== false) - Number(a.inStock !== false))
}

export type Ps5Model = 'ps5-digital' | 'ps5-disc' | 'ps5-pro' | 'series-s' | 'series-x'

/** Best guess at the model from the listing name; stores word these inconsistently. */
export function modelOf(name: string): Ps5Model {
  const clean = name.replace(/[®™]/g, '')
  if (XBOX_SERIES.test(clean)) return /\bseries ?x\b/i.test(clean) ? 'series-x' : 'series-s'
  if (/\bpro\b/i.test(clean)) return 'ps5-pro'
  if (/digital|\bdig\b/i.test(clean)) return 'ps5-digital'
  return 'ps5-disc'
}
