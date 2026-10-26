import { chromium } from 'playwright';
import { effectivePrice, isMultiBuy, parsePromo } from '../../../shared/promo.ts';
import type { Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { sleep } from '../http.ts';

/**
 * checkers.co.za blocks automated access, so Checkers specials come from the
 * leaflet aggregator cataloguespecials.co.za (robots.txt allows these pages).
 * Personal use only: keep the request rate low and do not republish the data.
 */
const ORIGIN = 'https://www.cataloguespecials.co.za';
const LISTING = `${ORIGIN}/stores/checkers/specials`;
const MAX_PAGES = 45;
const DELAY_MS = 1500;

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
export function mapCard(card: CardText, scrapedAt: string): Product | null {
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
  const promo = parsePromo(multiBuyText);
  const id = card.href.match(/offer=(\d+)/)?.[1] ?? card.href;
  return {
    store: 'checkers',
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

export const checkers: StoreAdapter = {
  store: 'checkers',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
        await page.goto(`${LISTING}?page=${pageNo}`, { waitUntil: 'domcontentloaded' });
        const found = await page.waitForSelector('a.js-offer-link-item', { timeout: 20_000 }).then(() => true, () => false);
        if (!found) break;
        const cards: CardText[] = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLAnchorElement>('a.js-offer-link-item')].map((a) => ({
            lines: a.innerText.split('\n'),
            href: a.getAttribute('href') ?? '',
            // The card also holds the store logo and UI icons; the product shot lives under /uploads/offers/.
            image: a.querySelector('img[src*="/uploads/offers/"]')?.getAttribute('src') ?? undefined,
          })),
        );
        let added = 0;
        for (const card of cards) {
          const p = mapCard(card, scrapedAt);
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
};
