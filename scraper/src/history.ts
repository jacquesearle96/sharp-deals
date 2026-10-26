import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PriceStats, Product, StoreId } from '../../shared/types.ts';

/** One product's price over time: [YYYY-MM-DD, best per-item price in rand]. */
export type Series = [string, number][];
export type HistoryFile = Record<string, Series>;

/** How far back history is kept. */
export const KEEP_DAYS = 120;
/** An unchanged price is re-recorded at least this often so the series never looks abandoned. */
const REFRESH_DAYS = 7;

const DAY = 86_400_000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Adds today's price, but only when it changed or the last point is getting old. */
export function appendPoint(series: Series | undefined, date: string, price: number): Series {
  if (!series || series.length === 0) return [[date, price]];
  const [lastDate, lastPrice] = series[series.length - 1];
  if (lastDate === date) return [...series.slice(0, -1), [date, price]];
  if (lastPrice !== price || daysBetween(lastDate, date) >= REFRESH_DAYS) return [...series, [date, price]];
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
  for (const p of products) next[p.id] = prune(appendPoint(next[p.id], date, p.effectivePrice), date);
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
  return {
    days: daysBetween(series[0][0], date),
    low: Math.min(...prices),
    high: Math.max(...prices),
    usual,
  };
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
