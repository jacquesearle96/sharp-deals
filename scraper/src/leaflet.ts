import { chromium, type Page } from 'playwright';
import { effectivePrice, isMultiBuy, parsePromo } from '../../shared/promo.ts';
import type { Product, Promo, StoreId } from '../../shared/types.ts';
import type { StoreAdapter } from './adapter.ts';
import { describePage, note } from './diagnostics.ts';
import { sleep } from './http.ts';

/**
 * Leaflet aggregator cataloguespecials.co.za lists item-level specials per store (robots.txt allows these pages).
 * Used for stores whose own site is closed to automated reading or only publishes leaflet images.
 * Personal use only: keep the request rate low and do not republish the data.
 */
const ORIGIN = 'https://www.cataloguespecials.co.za';
const MAX_PAGES = 45;
const DELAY_MS = 1500;
/** Tries per listing page before giving up on it. */
const PAGE_ATTEMPTS = 3;
/** Stop after this many listing pages in a row fail to show any offers. */
const MAX_FAILED_PAGES = 2;

export interface CardText {
  /** innerText of one offer card, split into lines */
  lines: string[];
  href: string;
  image?: string;
}

const PRICE_RE = /^R\s?(\d[\d\s]*),(\d{2})$/;
const toNumber = (s: string) => {
  const m = s.match(PRICE_RE);
  return m ? parseFloat(m[1].replace(/\s/g, '') + '.' + m[2]) : NaN;
};

/** "13 days" / "1 day" left in the catalogue becomes an end date (YYYY-MM-DD). */
export function endDate(daysLeft: string | undefined, now: Date): string | undefined {
  const m = daysLeft?.match(/^(\d+)\s+days?$/i);
  if (!m) return undefined;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + +m[1]));
  return d.toISOString().slice(0, 10);
}

/**
 * Card lines look like: [SAVE 60] | name | 13 days | [R 260,00] | R 200,00
 * The last price is the offer price; a leading price is the old price.
 * A "SAVE" badge only restates the saving, so only real multi-buy text becomes a promo.
 */
export function mapLeafletCard(card: CardText, store: StoreId, scrapedAt: string): Product | null {
  const lines = card.lines.map((l) => l.trim()).filter(Boolean);
  const prices = lines.filter((l) => PRICE_RE.test(l)).map(toNumber);
  if (prices.length === 0) return null;
  const price = prices[prices.length - 1];
  const wasPrice = prices.length > 1 && prices[0] > price ? prices[0] : undefined;

  const rest = lines.filter((l) => !PRICE_RE.test(l) && !/^save\b/i.test(l));
  const daysLine = rest.find((l) => /^\d+\s+days?$/i.test(l));
  const name = rest.find((l) => l !== daysLine);
  if (!name) return null;

  const multiBuyText = [name, ...rest].find((l) => isMultiBuy(parsePromo(l)));
  const parsed = parsePromo(multiBuyText);
  // Everything in a leaflet is a special, even when it shows no was-price, so it must count as a deal.
  const promo: Promo = parsed.kind === 'none' ? { kind: 'discount', raw: 'In the leaflet' } : parsed;
  const id = card.href.match(/offer[=-](\d+)/)?.[1] ?? card.href;
  return {
    store,
    id,
    name,
    price,
    wasPrice,
    promo,
    promoEnds: endDate(daysLine, new Date(scrapedAt)),
    effectivePrice: Math.round(effectivePrice(price, promo) * 100) / 100,
    url: card.href.startsWith('http') ? card.href : ORIGIN + card.href,
    image: card.image,
    category: 'grocery',
    scrapedAt,
  };
}

/**
 * Items the last run found that this run did not, kept while their leaflet is still running. A leaflet
 * item stays on offer until the leaflet ends, so a missing item almost always means a page failed to load.
 */
export function keepUnexpired(previous: Product[], fresh: Product[], today: string): Product[] {
  const seen = new Set(fresh.map((p) => p.id));
  return previous.filter((p) => !seen.has(p.id) && p.promoEnds !== undefined && p.promoEnds.slice(0, 10) >= today);
}

const readCards = (page: Page): Promise<CardText[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a.js-offer-link-item')].map((a) => ({
      lines: a.innerText.split('\n'),
      href: a.getAttribute('href') ?? '',
      // The card also holds the store logo and UI icons; the product shot lives under /uploads/offers/.
      image: a.querySelector('img[src*="/uploads/offers/"]')?.getAttribute('src') ?? undefined,
    })),
  );

/** True when the site answered "this page does not exist", which is how it marks the end of a store's listing. */
export const isNotFound = (status: number | undefined, title: string) => status === 404 || /^not found\b/i.test(title.trim());

/**
 * Opens one listing page, trying again (with a growing pause) when the offers do not show.
 * Returns 'end' when the page does not exist (past the last page), or null when it never loaded properly.
 */
async function loadPage(page: Page, url: string): Promise<CardText[] | 'end' | null> {
  for (let attempt = 1; attempt <= PAGE_ATTEMPTS; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      if (isNotFound(response?.status(), await page.title())) return 'end';
      if (await page.waitForSelector('a.js-offer-link-item', { timeout: 20_000 }).then(() => true, () => false)) {
        return await readCards(page);
      }
    } catch {
      // A navigation timeout or dropped connection: try again below.
    }
    if (attempt < PAGE_ATTEMPTS) await sleep(attempt * 5000);
  }
  return null;
}

/** An adapter for one store's page on the aggregator, e.g. slug "checkers" or "food-lover-s-market". */
export const createLeafletAdapter = (store: StoreId, slug: string): StoreAdapter => ({
  store,
  keepUnexpired: true,
  async run() {
    const LISTING = `${ORIGIN}/stores/${slug}/specials`;
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      let failedInARow = 0;
      for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
        const cards = await loadPage(page, `${LISTING}?page=${pageNo}`);
        if (cards === 'end') break;
        if (!cards) {
          // One slow or blocked page must not end the run: earlier this silently cut the listing short.
          note(`page ${pageNo} showed no offers after ${PAGE_ATTEMPTS} tries: ${await describePage(page)}`);
          if (++failedInARow >= MAX_FAILED_PAGES) break;
          continue;
        }
        failedInARow = 0;
        let added = 0;
        for (const card of cards) {
          const p = mapLeafletCard(card, store, scrapedAt);
          if (p && !byId.has(p.id)) {
            byId.set(p.id, p);
            added++;
          }
        }
        if (added === 0) break;
        await sleep(DELAY_MS);
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
});
