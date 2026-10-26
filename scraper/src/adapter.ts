import type { Product, StoreId } from '../../shared/types.ts';

/** One adapter per store. A failing adapter must never break the others. */
export interface StoreAdapter {
  store: StoreId;
  run(): Promise<Product[]>;
}
