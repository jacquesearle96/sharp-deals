import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parsePromo } from '../../shared/promo.ts';
import type { Product, StoreRun } from '../../shared/types.ts';
import { buildIndex, buildShopIndex, fixImage, mergeRuns, toDeal } from '../src/index-data.ts';

const product = (over: Partial<Product> & Pick<Product, 'store' | 'id' | 'name'>): Product => ({
  price: 100,
  promo: parsePromo(''),
  effectivePrice: 100,
  category: 'baby',
  scrapedAt: '2026-10-26T12:00:00.000Z',
  ...over,
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sharp-deals-'));
  await writeFile(join(dir, 'babycity.json'), JSON.stringify([
    product({ store: 'babycity', id: 'a', name: 'Baby Monitor', price: 800, wasPrice: 1000, effectivePrice: 800 }),
    product({ store: 'babycity', id: 'b', name: 'Cot Sheet' }),
  ]));
  await writeFile(join(dir, 'pnp.json'), JSON.stringify([
    product({ store: 'pnp', id: 'c', name: 'Milk 2L', category: 'grocery', promo: parsePromo('2 For R38.00'), price: 24.99, effectivePrice: 19 }),
    product({ store: 'pnp', id: 'd', name: 'Plain Bread', category: 'grocery' }),
  ]));
  await writeFile(join(dir, 'evetech.json'), JSON.stringify([product({ store: 'evetech', id: 'e', name: 'PS5 Controller', category: 'tech' })]));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const run = (store: StoreRun['store'], at = '2026-10-26T12:00:00.000Z'): StoreRun => ({ store, ok: true, count: 1, at });

describe('toDeal', () => {
  it('computes the saving against the was-price', () => {
    expect(toDeal(product({ store: 'babycity', id: 'x', name: 'x', price: 800, wasPrice: 1000, effectivePrice: 800 })).savePct).toBe(20);
  });
  it('drops the scrape timestamp', () => {
    expect('scrapedAt' in toDeal(product({ store: 'pnp', id: 'x', name: 'x' }))).toBe(false);
  });
});

describe('fixImage', () => {
  it('leaves full addresses alone', () => {
    expect(fixImage('pnp', 'https://cdn.pnp.co.za/a.jpg')).toBe('https://cdn.pnp.co.za/a.jpg');
    expect(fixImage('pnp', undefined)).toBeUndefined();
  });
  it('completes a Clicks path with the Clicks site', () => {
    expect(fixImage('clicks', '/medias/?context=abc')).toBe('https://clicks.co.za/medias/?context=abc');
  });
  it('drops relative paths for stores we cannot place', () => {
    expect(fixImage('babycity', '/x.jpg')).toBeUndefined();
  });
  it('is applied when a product becomes a deal', () => {
    expect(toDeal(product({ store: 'clicks', id: 'z', name: 'z', image: '/medias/?context=q' })).image).toBe('https://clicks.co.za/medias/?context=q');
  });
});

describe('buildIndex', () => {
  it('keeps only deals, from groceries and the two baby shops', async () => {
    const index = await buildIndex(dir, [run('pnp'), run('babycity'), run('evetech')]);
    expect(index.products.map((p) => p.id).sort()).toEqual(['a', 'c']);
    expect(index.runs.map((r) => r.store).sort()).toEqual(['babycity', 'pnp']);
    expect(JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')).products).toHaveLength(2);
  });
});

describe('buildShopIndex', () => {
  it('keeps every product from the shop stores, deal or not, and leaves groceries out', async () => {
    const index = await buildShopIndex(dir, [run('pnp'), run('babycity'), run('evetech')]);
    expect(index.products.map((p) => p.id).sort()).toEqual(['a', 'b', 'e']);
    expect(index.runs.map((r) => r.store).sort()).toEqual(['babycity', 'evetech']);
  });
});

describe('mergeRuns', () => {
  it('keeps earlier results for stores that were not in this run', async () => {
    await writeFile(join(dir, 'runs.json'), JSON.stringify([run('pnp', '2026-10-25T00:00:00.000Z')]));
    const merged = await mergeRuns(dir, [run('babycity')]);
    expect(merged.map((r) => r.store)).toEqual(['pnp', 'babycity']);
    expect(merged[0].at).toBe('2026-10-25T00:00:00.000Z');
  });
  it('keeps the last good run visible when a store fails', async () => {
    await writeFile(join(dir, 'runs.json'), JSON.stringify([run('pnp', '2026-10-25T00:00:00.000Z')]));
    const merged = await mergeRuns(dir, [{ store: 'pnp', ok: false, count: 0, error: 'boom', at: '2026-10-26T00:00:00.000Z' }]);
    expect(merged[0]).toMatchObject({ ok: true, at: '2026-10-25T00:00:00.000Z', error: 'boom' });
  });
});
