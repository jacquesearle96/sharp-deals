export type StoreId = 'checkers' | 'pnp' | 'woolworths' | 'spar' | 'clicks' | 'dischem';

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
