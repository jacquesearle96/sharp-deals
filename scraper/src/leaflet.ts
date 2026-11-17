import { effectivePrice, isMultiBuy, parsePromo } from '../../shared/promo.ts';
import type { Product, Promo, StoreId } from '../../shared/types.ts';
import type { StoreAdapter } from './adapter.ts';
import { note } from './diagnostics.ts';
import { sleep, UA } from './http.ts';

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

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENTITIES[e.toLowerCase()] ?? m),
  );

/**
 * Offer cards from a listing page's HTML (the site renders them on the server, so no browser is needed).
 * Each card's text pieces become its lines, in page order, like the card's innerText.
 */
export function parseCards(html: string): CardText[] {
  const cards: CardText[] = [];
  for (const m of html.matchAll(/<a\b[^>]*class="[^"]*\bjs-offer-link-item\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = decode(m[0].match(/\bhref="([^"]*)"/)?.[1] ?? '');
    const inner = m[1].replace(/<(script|style|button)\b[\s\S]*?<\/\1>/gi, '');
    const lines = inner
      .split(/<[^>]*>/)
      .map((t) => decode(t).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    // The card also holds the store logo and UI icons; the product shot lives under /uploads/offers/.
    const image = inner.match(/<img\b[^>]*\bsrc="([^"]*\/uploads\/offers\/[^"]*)"/)?.[1];
    cards.push({ lines, href, image: image && decode(image) });
  }
  return cards;
}

/** True when the site answered "this page does not exist", which is how it marks the end of a store's listing. */
export const isNotFound = (status: number | undefined, title: string) => status === 404 || /^not found\b/i.test(title.trim());

const titleOf = (html: string) => decode(html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '').trim();

/**
 * Opens one listing page, trying again (with a growing pause) when the offers do not show.
 * Returns 'end' when the page does not exist (past the last page), or a description of the problem when it never loaded properly.
 */
async function loadPage(url: string): Promise<CardText[] | 'end' | { problem: string }> {
  let problem = '';
  for (let attempt = 1; attempt <= PAGE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(45_000),
      });
      const html = await res.text();
      const title = titleOf(html);
      if (isNotFound(res.status, title)) return 'end';
      const cards = parseCards(html);
      if (cards.length) return cards;
      // e.g. a bot check: 202/403 with a "Just a moment..." page
      problem = `HTTP ${res.status}, title "${title}", ${html.length} bytes at ${url}`;
    } catch (err) {
      problem = `${String(err).slice(0, 120)} at ${url}`;
    }
    if (attempt < PAGE_ATTEMPTS) await sleep(attempt * 5000);
  }
  return { problem };
}

/** An adapter for one store's page on the aggregator, e.g. slug "checkers" or "food-lover-s-market". */
export const createLeafletAdapter = (store: StoreId, slug: string): StoreAdapter => ({
  store,
  keepUnexpired: true,
  async run() {
    const LISTING = `${ORIGIN}/stores/${slug}/specials`;
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    let failedInARow = 0;
    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      const cards = await loadPage(`${LISTING}?page=${pageNo}`);
      if (cards === 'end') break;
      if (!Array.isArray(cards)) {
        // One slow or blocked page must not end the run: earlier this silently cut the listing short.
        note(`page ${pageNo} showed no offers after ${PAGE_ATTEMPTS} tries: ${cards.problem}`);
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
    return [...byId.values()];
  },
});
