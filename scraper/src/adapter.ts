import type { Product, StoreId } from '../../shared/types.ts';

/** One adapter per store. A failing adapter must never break the others. */
export interface StoreAdapter {
  store: StoreId;
  run(): Promise<Product[]>;
  /**
   * Set for leaflet stores: an item stays valid until its leaflet ends, so items the last run found that
   * this run missed (a page that failed to load) are kept until their end date.
   */
  keepUnexpired?: boolean;
}
