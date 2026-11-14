import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOff } from '../../shared/storeSwitches.ts';
import { DEAL_STORES, SHOP_STORES, STORES, type Product, type StoreId, type StoreRun } from '../../shared/types.ts';
import type { StoreAdapter } from './adapter.ts';
import { dropRelativeImages, note, takeNotes } from './diagnostics.ts';
import { readHistory, updateHistory, writeHistory } from './history.ts';
import { buildIndex, buildShopIndex, mergeRuns, today } from './index-data.ts';
import { keepUnexpired } from './leaflet.ts';
import { babiesrus } from './stores/babiesrus.ts';
import { babycity } from './stores/babycity.ts';
import { checkers } from './stores/checkers.ts';
import { clicks } from './stores/clicks.ts';
import { dischem } from './stores/dischem.ts';
import { foodlovers } from './stores/foodlovers.ts';
import { pnp } from './stores/pnp.ts';
import { spar } from './stores/spar.ts';
import { woolworths } from './stores/woolworths.ts';

const ADAPTERS: StoreAdapter[] = [pnp, checkers, woolworths, foodlovers, clicks, dischem, spar, babycity, babiesrus];

/** "grocery" and "shop" select a whole section; otherwise name stores, e.g. "pnp spar". */
const GROUPS: Record<string, StoreId[]> = {
  grocery: [...STORES],
  shop: [...SHOP_STORES],
};
const OUT_DIR = join(import.meta.dirname, '..', '..', 'app', 'public', 'data');

/** Appends today's prices to the store's history file. */
const readPrevious = async (store: StoreId): Promise<Product[]> => {
  try {
    return JSON.parse(await readFile(join(OUT_DIR, `${store}.json`), 'utf8')) as Product[];
  } catch {
    return [];
  }
};

const recordHistory = async (store: StoreId, products: Product[]) =>
  writeHistory(OUT_DIR, store, updateHistory(await readHistory(OUT_DIR, store), products, today()));

// "index" rebuilds the indexes (and records history) from the store files already on disk, without scraping.
const reindexOnly = process.argv[2] === 'index';
const only = (reindexOnly ? [] : process.argv.slice(2)).flatMap((a) => GROUPS[a] ?? [a as StoreId]);
// Stores switched off in the app's Settings. They are not scraped and their deals are left out of the app,
// unless a run names them explicitly.
const off = parseOff(process.env.GROCERY_STORES_OFF, DEAL_STORES).filter((s) => !only.includes(s));
if (off.length) console.log(`switched off: ${off.join(' ')}`);
const selected = reindexOnly
  ? []
  : ADAPTERS.filter((a) => (only.length ? only.includes(a.store) : true) && !off.includes(a.store));

await mkdir(OUT_DIR, { recursive: true });
const runs: StoreRun[] = [];
const all: Product[] = [];

for (const adapter of selected) {
  const at = new Date().toISOString();
  takeNotes(); // start this store with a clean list
  try {
    let scraped = await adapter.run();
    if (scraped.length === 0) throw new Error('adapter returned no products');
    const previous = await readPrevious(adapter.store);
    if (adapter.keepUnexpired) {
      const kept = keepUnexpired(previous, scraped, today());
      if (kept.length) note(`found ${scraped.length}; kept ${kept.length} unexpired items from the last run`);
      scraped = [...scraped, ...kept];
    } else if (previous.length >= 50 && scraped.length < previous.length / 2) {
      note(`only ${scraped.length} products, down from ${previous.length} last run`);
    }
    const { products, dropped } = dropRelativeImages(scraped);
    if (dropped) note(`${dropped} images had a relative address and were dropped`);
    await writeFile(join(OUT_DIR, `${adapter.store}.json`), JSON.stringify(products));
    await recordHistory(adapter.store, products);
    all.push(...products);
    runs.push({ store: adapter.store, ok: true, count: products.length, at, notes: takeNotes() });
    console.log(`${adapter.store}: ${products.length} products`);
  } catch (err) {
    // Keep the previous data file; just record the failure.
    runs.push({ store: adapter.store, ok: false, count: 0, error: String(err), at, notes: takeNotes() });
    console.error(`${adapter.store} FAILED:`, err);
  }
}

if (reindexOnly) {
  for (const store of [...STORES, ...SHOP_STORES]) {
    try {
      const products = JSON.parse(await readFile(join(OUT_DIR, `${store}.json`), 'utf8')) as Product[];
      await recordHistory(store, products);
    } catch {
      // No data file for this store yet.
    }
  }
}

const merged = await mergeRuns(OUT_DIR, runs);
await writeFile(join(OUT_DIR, 'runs.json'), JSON.stringify(merged, null, 1));
const index = await buildIndex(OUT_DIR, merged, off);
console.log(`index: ${index.products.length} deals from ${index.runs.filter((r) => r.ok).length} grocery stores`);
const shopIndex = await buildShopIndex(OUT_DIR, merged, off);
console.log(`shop-index: ${shopIndex.products.length} products from ${shopIndex.runs.filter((r) => r.ok).length} shops`);
if (runs.some((r) => !r.ok)) process.exitCode = 1;
