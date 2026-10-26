export type ShopCategory = 'tech' | 'baby'

export interface Retailer {
  id: string
  name: string
  color: string
  categories: ShopCategory[]
  /** Builds the retailer's own search results URL for a query. */
  searchUrl: (q: string) => string
  /** Short note shown under the button */
  note?: string
}

const enc = encodeURIComponent

/** Shops the "Shop around" tab can open a search on. */
export const RETAILERS: Retailer[] = [
  { id: 'takealot', name: 'Takealot', color: '#0b79bf', categories: ['tech', 'baby'], searchUrl: (q) => `https://www.takealot.com/all?qsearch=${enc(q)}` },
  { id: 'amazon', name: 'Amazon.co.za', color: '#f59e0b', categories: ['tech', 'baby'], searchUrl: (q) => `https://www.amazon.co.za/s?k=${enc(q)}` },
  { id: 'makro', name: 'Makro', color: '#1d4ed8', categories: ['tech', 'baby'], searchUrl: (q) => `https://www.makro.co.za/search?q=${enc(q)}` },
  { id: 'game', name: 'Game', color: '#dc2626', categories: ['tech'], searchUrl: (q) => `https://www.game.co.za/game-za/en/search/?text=${enc(q)}` },
  { id: 'incredible', name: 'Incredible Connection', color: '#7c3aed', categories: ['tech'], searchUrl: (q) => `https://www.incredible.co.za/catalogsearch/result?q=${enc(q)}` },
  { id: 'evetech', name: 'Evetech', color: '#0f766e', categories: ['tech'], searchUrl: (q) => `https://www.evetech.co.za/search?q=${enc(q)}` },
  { id: 'wootware', name: 'Wootware', color: '#ea580c', categories: ['tech'], searchUrl: (q) => `https://www.wootware.co.za/catalogsearch/result/?q=${enc(q)}` },
  { id: 'babycity', name: 'Baby City', color: '#ec4899', categories: ['baby'], searchUrl: (q) => `https://www.babycity.co.za/search?q=${enc(q)}` },
  { id: 'babiesrus', name: 'Babies R Us', color: '#0ea5e9', categories: ['baby'], searchUrl: (q) => `https://www.babiesrus.co.za/search?q=${enc(q)}` },
  {
    id: 'pricecheck',
    name: 'PriceCheck',
    color: '#16a34a',
    categories: ['tech', 'baby'],
    searchUrl: (q) => `https://www.pricecheck.co.za/search?search=${enc(q)}`,
    note: 'Compares many shops',
  },
]

export const retailersFor = (category: ShopCategory) => RETAILERS.filter((r) => r.categories.includes(category))

/** Quick-start searches for each section. */
export const IDEAS: Record<ShopCategory, string[]> = {
  tech: ['PS5', 'Xbox', 'Nintendo Switch', '65 inch TV', 'Laptop', 'iPhone', 'AirPods', 'Air fryer'],
  baby: ['Baby monitor', 'Car seat', 'Pram', 'Cot', 'Nappies', 'Breast pump', 'Baby carrier', 'High chair'],
}

/** Black Friday is the fourth Friday of November. */
export function blackFriday(year: number): Date {
  const first = new Date(Date.UTC(year, 10, 1))
  const firstFriday = 1 + ((5 - first.getUTCDay() + 7) % 7)
  return new Date(Date.UTC(year, 10, firstFriday + 21))
}

/** Whole days from `now` until Black Friday this year (negative once it has passed). */
export function daysToBlackFriday(now = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((blackFriday(now.getFullYear()).getTime() - today) / 86_400_000)
}
