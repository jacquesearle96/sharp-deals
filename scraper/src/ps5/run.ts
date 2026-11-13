import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isPs5Console, PS5_STORES, sortOffers, type Ps5Feed, type Ps5Offer, type Ps5StoreRun } from '../../../shared/ps5.ts';
import { SOURCES } from './sources.ts';

/**
 * TEMPORARY (Black Friday 2026). Reads PS5 console prices from every store and writes app/public/data/ps5.json.
 * A store that fails keeps its offers from the last run that worked, so one blocked site never empties the page.
 * Usage: node src/ps5/run.ts [store ...]
 */
const OUT = join(import.meta.dirname, '..', '..', '..', 'app', 'public', 'data', 'ps5.json');

const previous: Ps5Feed = await readFile(OUT, 'utf8')
  .then((s) => JSON.parse(s) as Ps5Feed)
  .catch(() => ({ generatedAt: '', offers: [], runs: [] }));

const only = process.argv.slice(2);
const selected = only.length ? SOURCES.filter((s) => only.includes(s.store)) : SOURCES;

// Each store is a different site, so they are read side by side; each reader is polite within its own site.
const results = await Promise.all(
  selected.map(async ({ store, read }) => {
    const at = new Date().toISOString();
    try {
      const seen = new Set<string>();
      const offers: Ps5Offer[] = [];
      for (const l of await read()) {
        if (!isPs5Console(l.name, l.price) || seen.has(l.url)) continue;
        seen.add(l.url);
        offers.push({ store, ...l });
      }
      if (offers.length === 0) throw new Error('no PS5 consoles found (the page layout may have changed)');
      console.log(`${store}: ${offers.length} consoles`);
      return { run: { store, ok: true, count: offers.length, at } satisfies Ps5StoreRun, offers };
    } catch (err) {
      console.error(`${store} FAILED:`, err);
      const last = previous.runs.find((r) => r.store === store);
      const kept = previous.offers.filter((o) => o.store === store);
      return {
        run: { store, ok: false, count: kept.length, at: last?.at, error: String(err).slice(0, 200) } satisfies Ps5StoreRun,
        offers: kept,
      };
    }
  }),
);

const ran = new Set(selected.map((s) => s.store));
const feed: Ps5Feed = {
  generatedAt: new Date().toISOString(),
  offers: sortOffers([...previous.offers.filter((o) => !ran.has(o.store)), ...results.flatMap((r) => r.offers)]),
  runs: (Object.keys(PS5_STORES) as (keyof typeof PS5_STORES)[]).flatMap((store) => {
    const run = results.find((r) => r.run.store === store)?.run ?? previous.runs.find((r) => r.store === store);
    return run ? [run] : [];
  }),
};

await mkdir(join(OUT, '..'), { recursive: true });
await writeFile(OUT, JSON.stringify(feed));
console.log(`ps5.json: ${feed.offers.length} offers from ${feed.runs.filter((r) => r.ok).length} stores`);
if (results.some((r) => !r.run.ok)) process.exitCode = 1;
