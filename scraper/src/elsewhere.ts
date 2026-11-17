import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOff } from '../../shared/storeSwitches.ts';
import { DEAL_STORES, type StoreId, type StoreRun } from '../../shared/types.ts';

/**
 * Hands the results of stores scraped outside GitHub (their sites refuse GitHub's servers) to the GitHub scrape.
 *
 *   node src/elsewhere.ts pack  <data dir> <out dir> <stores...>  copies each store's file and run record to <out dir>
 *   node src/elsewhere.ts apply <from dir> <data dir>             copies them into the data, replacing those stores' run records
 *
 * The scheduled task packs and pushes <out dir> as the data-elsewhere branch; the GitHub workflow applies it before scraping,
 * so only the GitHub workflow ever writes the data branch.
 */
const RUNS = 'runs.json';

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

/** Run records with the given stores' records replaced by the incoming ones (or added at the end). */
export function replaceRuns(runs: StoreRun[], incoming: StoreRun[]): StoreRun[] {
  const byStore = new Map(incoming.map((r) => [r.store, r]));
  const out = runs.map((r) => byStore.get(r.store) ?? r);
  for (const r of incoming) if (!runs.some((x) => x.store === r.store)) out.push(r);
  return out;
}

async function pack(dataDir: string, outDir: string, stores: StoreId[]) {
  await mkdir(outDir, { recursive: true });
  const runs = (await readJson<StoreRun[]>(join(dataDir, RUNS))) ?? [];
  for (const s of stores) await copyFile(join(dataDir, `${s}.json`), join(outDir, `${s}.json`));
  await writeFile(join(outDir, RUNS), JSON.stringify(runs.filter((r) => stores.includes(r.store)), null, 1));
  console.log(`packed ${stores.join(' ')}`);
}

async function apply(fromDir: string, dataDir: string) {
  const incoming = (await readJson<StoreRun[]>(join(fromDir, RUNS))) ?? [];
  const stores = incoming.map((r) => r.store);
  for (const s of stores) await copyFile(join(fromDir, `${s}.json`), join(dataDir, `${s}.json`));
  const runs = (await readJson<StoreRun[]>(join(dataDir, RUNS))) ?? [];
  await writeFile(join(dataDir, RUNS), JSON.stringify(replaceRuns(runs, incoming), null, 1));
  for (const r of incoming) console.log(`applied ${r.store}: ${r.count} products from ${r.at}${r.error ? ` (latest attempt failed: ${r.error})` : ''}`);
}

if (import.meta.main) {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  if (cmd === 'pack' && a && b) await pack(a, b, parseOff(rest.join(' '), DEAL_STORES));
  else if (cmd === 'apply' && a && b) await apply(a, b);
  else {
    console.error('usage: elsewhere.ts pack <data dir> <out dir> <stores...> | apply <from dir> <data dir>');
    process.exit(2);
  }
}
