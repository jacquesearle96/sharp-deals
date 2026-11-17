import { describe, expect, it } from 'vitest';
import type { StoreRun } from '../../shared/types.ts';
import { replaceRuns } from '../src/elsewhere.ts';

const run = (store: StoreRun['store'], count: number, at: string, error?: string): StoreRun => ({ store, ok: true, count, at, error });

describe('replaceRuns', () => {
  it('swaps in the records of stores scraped elsewhere and keeps the rest in order', () => {
    const before = [run('pnp', 10962, '2026-11-17T08:08Z'), run('checkers', 1742, '2026-11-12T07:31Z', 'blocked'), run('spar', 10, '2026-11-17T08:44Z')];
    const after = replaceRuns(before, [run('checkers', 1550, '2026-11-17T17:40Z')]);
    expect(after.map((r) => [r.store, r.count, r.error])).toEqual([['pnp', 10962, undefined], ['checkers', 1550, undefined], ['spar', 10, undefined]]);
  });
  it('adds a store the data has no record of yet', () => {
    expect(replaceRuns([], [run('foodlovers', 113, '2026-11-17T17:40Z')]).map((r) => r.store)).toEqual(['foodlovers']);
  });
});
