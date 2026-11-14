/**
 * Which stores a scrape skips. Settings in the app saves the switched-off stores as a GitHub repository variable
 * (a space-separated list of store ids, e.g. "checkers dischem"); the workflows hand it to the scrapers.
 * Storing the stores that are off, not on, means a newly added store is scraped by default.
 */

/** The repository variables, one per scrape. */
export const OFF_VARIABLES = {
  grocery: 'GROCERY_STORES_OFF',
  ps5: 'PS5_STORES_OFF',
} as const

export type Scrape = keyof typeof OFF_VARIABLES

/** Reads the variable's value, keeping only known store ids (anything else is ignored). */
export function parseOff<T extends string>(value: string | undefined | null, known: readonly T[]): T[] {
  const words = (value ?? '').toLowerCase().split(/[\s,]+/)
  return known.filter((id) => words.includes(id))
}

/** The variable's value for a set of switched-off stores, in a stable order. GitHub rejects an empty value, so "none" stands for none. */
export function formatOff<T extends string>(off: readonly T[], known: readonly T[]): string {
  const ids = known.filter((id) => off.includes(id))
  return ids.length ? ids.join(' ') : 'none'
}
