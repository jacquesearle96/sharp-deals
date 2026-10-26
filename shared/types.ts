export type GroceryStoreId = 'checkers' | 'pnp' | 'woolworths' | 'spar' | 'clicks' | 'dischem';
export type ShopStoreId = 'babycity' | 'babiesrus' | 'evetech' | 'takealot' | 'incredible';
export type StoreId = GroceryStoreId | ShopStoreId;

/** Stores behind the grocery deals tabs. */
export const STORES: GroceryStoreId[] = ['pnp', 'checkers', 'woolworths', 'spar', 'clicks', 'dischem'];
/** Stores whose specials show on the main deals tabs: the groceries plus the two baby shops. */
export const DEAL_STORES: StoreId[] = [...STORES, 'babycity', 'babiesrus'];
/** Stores behind the Shop around tab (baby and tech). */
export const SHOP_STORES: ShopStoreId[] = ['babycity', 'babiesrus', 'evetech', 'takealot', 'incredible'];

export type Category = 'grocery' | 'health' | 'baby' | 'tech';

/** Structured form of a store's promo text. `qty` is how many items must be bought. */
export type Promo =
  | { kind: 'none'; raw: string }
  | { kind: 'discount'; raw: string }
  | { kind: 'free'; raw: string; qty: number; payFor: number }
  | { kind: 'price'; raw: string; qty: number; total: number }
  | { kind: 'save'; raw: string; qty: number; save: number }
  | { kind: 'percent'; raw: string; qty: number; percent: number };

export interface Product {
  store: StoreId;
  id: string;
  name: string;
  brand?: string;
  /** Pack size as displayed, e.g. "750ml" */
  size?: string;
  /** Shelf price for a single item, in rand */
  price: number;
  wasPrice?: number;
  promo: Promo;
  /** ISO date when the promo starts, if it is not live yet */
  promoStarts?: string;
  /** ISO timestamp when the promo ends, if the store says */
  promoEnds?: string;
  /** Best price per item when the promo is taken up, in rand */
  effectivePrice: number;
  url?: string;
  image?: string;
  category: Category;
  /** ISO timestamp */
  scrapedAt: string;
}

export interface StoreRun {
  store: StoreId;
  ok: boolean;
  count: number;
  error?: string;
  /** ISO timestamp */
  at: string;
}

/** What we have seen this product cost, over the days we have tracked it. */
export interface PriceStats {
  /** Days between the first and latest price we recorded */
  days: number;
  /** Lowest and highest best-per-item price seen */
  low: number;
  high: number;
  /** Typical price: the one that stayed in force for the longest share of the time */
  usual: number;
}

/** A product as the app sees it: deals only, with the saving precomputed. */
export interface DealProduct extends Omit<Product, 'scrapedAt'> {
  /** Percentage saved against the was-price (or shelf price when there is no was-price) */
  savePct: number;
  /** Present once we have tracked the product for at least a day */
  hist?: PriceStats;
}

/** The single file the app loads. */
export interface DealIndex {
  generatedAt: string;
  runs: StoreRun[];
  products: DealProduct[];
}
