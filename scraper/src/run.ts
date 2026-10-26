import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SHOP_STORES, STORES, type Product, type StoreId, type StoreRun } from '../../shared/types.ts';
import type { StoreAdapter } from './adapter.ts';
import { buildIndex, buildShopIndex, mergeRuns } from './index-data.ts';
import { babiesrus } from './stores/babiesrus.ts';
import { babycity } from './stores/babycity.ts';
import { checkers } from './stores/checkers.ts';
import { clicks } from './stores/clicks.ts';
import { dischem } from './stores/dischem.ts';
import { pnp } from './stores/pnp.ts';
import { spar } from './stores/spar.ts';
import { woolworths } from './stores/woolworths.ts';

const ADAPTERS: StoreAdapter[] = [pnp, checkers, woolworths, clicks, dischem, spar, babycity, babiesrus];

/** "grocery" and "shop" select a whole section; otherwise name stores, e.g. "pnp spar". */
const GROUPS: Record<string, StoreId[]> = {
  grocery: [...STORES],
  shop: [...SHOP_STORES],
};
const OUT_DIR = join(import.meta.dirname, '..', '..', 'app', 'public', 'data');

const only = process.argv.slice(2).flatMap((a) => GROUPS[a] ?? [a as StoreId]);
const selected = only.length ? ADAPTERS.filter((a) => only.includes(a.store)) : ADAPTERS;

await mkdir(OUT_DIR, { recursive: true });
const runs: StoreRun[] = [];
const all: Product[] = [];

for (const adapter of selected) {
  const at = new Date().toISOString();
  try {
    const products = await adapter.run();
    if (products.length === 0) throw new Error('adapter returned no products');
    await writeFile(join(OUT_DIR, `${adapter.store}.json`), JSON.stringify(products));
    all.push(...products);
    runs.push({ store: adapter.store, ok: true, count: products.length, at });
    console.log(`${adapter.store}: ${products.length} products`);
  } catch (err) {
    // Keep the previous data file; just record the failure.
    runs.push({ store: adapter.store, ok: false, count: 0, error: String(err), at });
    console.error(`${adapter.store} FAILED:`, err);
  }
}

const merged = await mergeRuns(OUT_DIR, runs);
await writeFile(join(OUT_DIR, 'runs.json'), JSON.stringify(merged, null, 1));
const index = await buildIndex(OUT_DIR, merged);
console.log(`index: ${index.products.length} deals from ${index.runs.filter((r) => r.ok).length} grocery stores`);
const shopIndex = await buildShopIndex(OUT_DIR, merged);
console.log(`shop-index: ${shopIndex.products.length} products from ${shopIndex.runs.filter((r) => r.ok).length} shops`);
if (runs.some((r) => !r.ok)) process.exitCode = 1;
