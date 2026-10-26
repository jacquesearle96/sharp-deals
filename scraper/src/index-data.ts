import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readHistory, stats } from './history.ts';
import { DEAL_STORES, SHOP_STORES, STORES, type DealIndex, type DealProduct, type PriceStats, type Product, type StoreRun } from '../../shared/types.ts';

export const today = () => new Date().toISOString().slice(0, 10);

const isDeal = (p: Product) => p.promo.kind !== 'none' || (p.wasPrice !== undefined && p.wasPrice > p.price);

export function toDeal(p: Product, hist?: PriceStats): DealProduct {
  const { scrapedAt: _scrapedAt, ...rest } = p;
  const reference = p.wasPrice ?? p.price;
  const savePct = Math.max(0, Math.round((1 - p.effectivePrice / reference) * 100));
  return hist && hist.days >= 1 ? { ...rest, savePct, hist } : { ...rest, savePct };
}

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

/** Merges the grocery and baby-shop specials into the one compact deals-only index the main tabs load. */
export async function buildIndex(dir: string, runs: StoreRun[]): Promise<DealIndex> {
  const products: DealProduct[] = [];
  for (const store of DEAL_STORES) {
    const items = await readJson<Product[]>(join(dir, `${store}.json`));
    if (items) {
      const history = await readHistory(dir, store);
      products.push(...items.filter(isDeal).map((p) => toDeal(p, stats(history[p.id], today()))));
    }
  }
  const index: DealIndex = { generatedAt: new Date().toISOString(), runs: runs.filter((r) => DEAL_STORES.includes(r.store)), products };
  await writeFile(join(dir, 'index.json'), JSON.stringify(index));
  return index;
}

/** Merges the baby and tech shops into shop-index.json. Unlike groceries, every product is kept so any search can find it. */
export async function buildShopIndex(dir: string, runs: StoreRun[]): Promise<DealIndex> {
  const products: DealProduct[] = [];
  for (const store of SHOP_STORES) {
    const items = await readJson<Product[]>(join(dir, `${store}.json`));
    if (items) {
      const history = await readHistory(dir, store);
      products.push(...items.map((p) => toDeal(p, stats(history[p.id], today()))));
    }
  }
  const index: DealIndex = { generatedAt: new Date().toISOString(), runs: runs.filter((r) => (SHOP_STORES as string[]).includes(r.store)), products };
  await writeFile(join(dir, 'shop-index.json'), JSON.stringify(index));
  return index;
}

/** Latest run per store, keeping earlier results for stores that were not part of this run. */
export async function mergeRuns(dir: string, current: StoreRun[]): Promise<StoreRun[]> {
  const previous = (await readJson<StoreRun[]>(join(dir, 'runs.json'))) ?? [];
  const byStore = new Map(previous.map((r) => [r.store, r]));
  for (const r of current) {
    const before = byStore.get(r.store);
    // A failed run keeps the last good timestamp visible alongside the error.
    byStore.set(r.store, r.ok || !before ? r : { ...before, error: r.error });
  }
  return [...STORES, ...SHOP_STORES].flatMap((s) => (byStore.has(s) ? [byStore.get(s)!] : []));
}
