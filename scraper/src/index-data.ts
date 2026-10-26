import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { STORES, type DealIndex, type DealProduct, type Product, type StoreRun } from '../../shared/types.ts';

const isDeal = (p: Product) => p.promo.kind !== 'none' || (p.wasPrice !== undefined && p.wasPrice > p.price);

export function toDeal(p: Product): DealProduct {
  const { scrapedAt: _scrapedAt, ...rest } = p;
  const reference = p.wasPrice ?? p.price;
  const savePct = Math.max(0, Math.round((1 - p.effectivePrice / reference) * 100));
  return { ...rest, savePct };
}

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

/** Merges every store file in `dir` into one compact deals-only index the app loads. */
export async function buildIndex(dir: string, runs: StoreRun[]): Promise<DealIndex> {
  const products: DealProduct[] = [];
  for (const store of STORES) {
    const items = await readJson<Product[]>(join(dir, `${store}.json`));
    if (items) products.push(...items.filter(isDeal).map(toDeal));
  }
  const index: DealIndex = { generatedAt: new Date().toISOString(), runs, products };
  await writeFile(join(dir, 'index.json'), JSON.stringify(index));
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
  return STORES.flatMap((s) => (byStore.has(s) ? [byStore.get(s)!] : []));
}
