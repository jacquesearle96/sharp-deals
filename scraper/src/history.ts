import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeal } from '../../shared/promo.ts';
import type { PriceStats, Product, StoreId } from '../../shared/types.ts';

/**
 * One product's price over time: [YYYY-MM-DD, best per-item price in rand], with a trailing 1 when the
 * store had no special on the product that day. That is the only way to learn its normal price: stores
 * that list specials only show the special price, so a run of identical prices proves nothing on its own.
 */
export type Point = [string, number] | [string, number, 1];
export type Series = Point[];
export type HistoryFile = Record<string, Series>;

/** How far back history is kept. */
export const KEEP_DAYS = 120;
/** An unchanged price is re-recorded at least this often so the series never looks abandoned. */
const REFRESH_DAYS = 7;

const DAY = 86_400_000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

const isRegular = (p: Point) => p[2] === 1;

/** Adds today's price, but only when it (or whether it was on special) changed, or the last point is getting old. */
export function appendPoint(series: Series | undefined, date: string, price: number, regular = false): Series {
  const point: Point = regular ? [date, price, 1] : [date, price];
  if (!series || series.length === 0) return [point];
  const last = series[series.length - 1];
  if (last[0] === date) return [...series.slice(0, -1), point];
  if (last[1] !== price || isRegular(last) !== regular || daysBetween(last[0], date) >= REFRESH_DAYS) return [...series, point];
  return series;
}

/** Drops points older than the window, keeping the newest one that precedes it so the start is known. */
export function prune(series: Series, date: string): Series {
  const cutoff = series.findIndex(([d]) => daysBetween(d, date) <= KEEP_DAYS);
  if (cutoff <= 0) return series;
  return series.slice(cutoff - 1);
}

export function updateHistory(prev: HistoryFile, products: Product[], date: string): HistoryFile {
  const next: HistoryFile = {};
  for (const [id, series] of Object.entries(prev)) {
    const kept = prune(series, date);
    if (daysBetween(kept[kept.length - 1][0], date) <= KEEP_DAYS) next[id] = kept;
  }
  for (const p of products) next[p.id] = prune(appendPoint(next[p.id], date, p.effectivePrice, !isDeal(p)), date);
  return next;
}

/** Time-weighted summary of a series: each price counts for as long as it stayed in force. */
export function stats(series: Series | undefined, date: string): PriceStats | undefined {
  if (!series || series.length === 0) return undefined;
  const spans = series.map(([d, price], i) => {
    const end = i + 1 < series.length ? series[i + 1][0] : date;
    return { price, days: Math.max(1, daysBetween(d, end)) };
  });
  const total = spans.reduce((s, x) => s + x.days, 0);
  let acc = 0;
  let usual = spans[0].price;
  for (const s of [...spans].sort((a, b) => a.price - b.price)) {
    acc += s.days;
    if (acc >= total / 2) {
      usual = s.price;
      break;
    }
  }
  const prices = series.map(([, p]) => p);
  const regulars = series.filter(isRegular);
  const out: PriceStats = {
    days: daysBetween(series[0][0], date),
    low: Math.min(...prices),
    high: Math.max(...prices),
    usual,
    steady: steadyDays(series, date),
  };
  if (regulars.length) {
    out.regular = regulars[regulars.length - 1][1];
    out.regularHigh = Math.max(...regulars.map(([, p]) => p));
  }
  return out;
}

/**
 * Days the latest price has held. An unchanged price is re-recorded weekly, so a longer gap between points
 * means the product dropped out of the listings for a while (say, between two promotions) and the count
 * starts again after it.
 */
export function steadyDays(series: Series, date: string): number {
  const maxGap = REFRESH_DAYS + 1;
  const last = series[series.length - 1];
  if (daysBetween(last[0], date) > maxGap) return 0;
  let start = last[0];
  for (let i = series.length - 2; i >= 0; i--) {
    if (series[i][1] !== last[1] || daysBetween(series[i][0], start) > maxGap) break;
    start = series[i][0];
  }
  return daysBetween(start, date);
}

export const historyPath = (dir: string, store: StoreId) => join(dir, 'history', `${store}.json`);

export async function readHistory(dir: string, store: StoreId): Promise<HistoryFile> {
  try {
    return JSON.parse(await readFile(historyPath(dir, store), 'utf8')) as HistoryFile;
  } catch {
    return {};
  }
}

export async function writeHistory(dir: string, store: StoreId, history: HistoryFile): Promise<void> {
  await mkdir(join(dir, 'history'), { recursive: true });
  await writeFile(historyPath(dir, store), JSON.stringify(history));
}
