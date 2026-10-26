import { describe, expect, it } from 'vitest';
import { parsePromo } from '../../shared/promo.ts';
import type { Product } from '../../shared/types.ts';
import { appendPoint, daysBetween, KEEP_DAYS, prune, stats, updateHistory, type Series } from '../src/history.ts';
import { toDeal } from '../src/index-data.ts';

const product = (id: string, effectivePrice: number): Product => ({
  store: 'babycity',
  id,
  name: id,
  price: effectivePrice,
  promo: parsePromo(''),
  effectivePrice,
  category: 'baby',
  scrapedAt: '2026-10-26T00:00:00.000Z',
});

describe('appendPoint', () => {
  it('starts a series', () => {
    expect(appendPoint(undefined, '2026-10-26', 100)).toEqual([['2026-10-26', 100]]);
  });
  it('adds a point when the price changes', () => {
    expect(appendPoint([['2026-10-26', 100]], '2026-10-27', 80)).toEqual([['2026-10-26', 100], ['2026-10-27', 80]]);
  });
  it('skips an unchanged price, until a week has passed', () => {
    const s: Series = [['2026-10-20', 100]];
    expect(appendPoint(s, '2026-10-22', 100)).toBe(s);
    expect(appendPoint(s, '2026-10-27', 100)).toHaveLength(2);
  });
  it('replaces the point when run twice in one day', () => {
    expect(appendPoint([['2026-10-26', 100]], '2026-10-26', 90)).toEqual([['2026-10-26', 90]]);
  });
});

describe('prune and updateHistory', () => {
  it('drops old points but keeps the newest one before the window', () => {
    const s: Series = [['2025-01-01', 50], ['2025-06-01', 60], ['2026-10-01', 70]];
    expect(prune(s, '2026-10-26')).toEqual([['2025-06-01', 60], ['2026-10-01', 70]]);
  });
  it('keeps products that vanished from the latest run, and drops long-gone ones', () => {
    const prev = { gone: [['2025-01-01', 10]] as Series, away: [['2026-10-20', 20]] as Series };
    const next = updateHistory(prev, [product('new', 5)], '2026-10-26');
    expect(Object.keys(next).sort()).toEqual(['away', 'new']);
    expect(KEEP_DAYS).toBeGreaterThan(30);
  });
});

describe('stats', () => {
  it('is undefined without data', () => {
    expect(stats(undefined, '2026-10-26')).toBeUndefined();
  });
  it('reports low, high and the usual price weighted by time in force', () => {
    // R100 for 20 days, R70 for 3 days, R100 again for 2 days.
    const s: Series = [['2026-10-01', 100], ['2026-10-21', 70], ['2026-10-24', 100]];
    expect(stats(s, '2026-10-26')).toEqual({ days: 25, low: 70, high: 100, usual: 100 });
  });
  it('a one-day-old series has zero days', () => {
    expect(stats([['2026-10-26', 50]], '2026-10-26')?.days).toBe(0);
  });
  it('counts days between dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-26')).toBe(25);
  });
});

describe('toDeal with history', () => {
  it('attaches stats once there is at least a day of history', () => {
    const p = product('a', 80);
    expect(toDeal(p, { days: 0, low: 80, high: 80, usual: 80 }).hist).toBeUndefined();
    expect(toDeal(p, { days: 14, low: 70, high: 100, usual: 100 }).hist).toEqual({ days: 14, low: 70, high: 100, usual: 100 });
    expect(toDeal(p).hist).toBeUndefined();
  });
});
