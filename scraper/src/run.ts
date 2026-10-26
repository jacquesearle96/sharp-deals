import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Product, StoreId, StoreRun } from '../../shared/types.ts';
import type { StoreAdapter } from './adapter.ts';
import { clicks } from './stores/clicks.ts';
import { pnp } from './stores/pnp.ts';
import { woolworths } from './stores/woolworths.ts';

const ADAPTERS: StoreAdapter[] = [pnp, woolworths, clicks];
const OUT_DIR = join(import.meta.dirname, '..', '..', 'app', 'public', 'data');

const only = process.argv.slice(2) as StoreId[];
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

await writeFile(join(OUT_DIR, 'runs.json'), JSON.stringify(runs, null, 1));
if (runs.some((r) => !r.ok)) process.exitCode = 1;
