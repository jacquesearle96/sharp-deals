import { chromium } from 'playwright';
import { effectivePrice, parsePromo } from '../../../shared/promo.ts';
import type { Category, Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { sleep } from '../http.ts';
import { activeTerms } from '../terms.ts';

const SEARCH = 'https://www.woolworths.co.za/browse?searchterm=';
const MAX_PAGES_PER_TERM = 3;
const DELAY_MS = 1000;

const SIZE_RE = /(\d+(?:\.\d+)?\s?(?:g|kg|ml|l|ea|pk|pack))\s*$/i;
const PRICE_RE = /R\s?(\d[\d\s]*\.\d{2})/g;
const PROMO_RE = /\bfor\b|\bsave\b|\bbuy\b|% off|\bget\b/i;

export interface CardText {
  /** innerText of one product card, split into lines */
  lines: string[];
  image?: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Card lines look like: name | (reviews) | [promo text] | R was R now */
export function mapCard(card: CardText, scrapedAt: string): Product | null {
  const lines = card.lines.map((l) => l.trim()).filter(Boolean);
  // Some cards lead with an all-caps brand line before the product name.
  const hasBrandLine =
    lines.length > 2 && lines[0] === lines[0].toUpperCase() && !/^\(\d+\)$|^R\s?\d/.test(lines[1]);
  const brand = hasBrandLine ? lines[0] : undefined;
  const name = hasBrandLine ? lines[1] : lines[0];
  const priceLine = [...lines].reverse().find((l) => /^R\s?\d/.test(l));
  if (!name || !priceLine) return null;

  const prices = [...priceLine.matchAll(PRICE_RE)].map((m) => parseFloat(m[1].replace(/\s/g, '')));
  const price = prices[prices.length - 1];
  if (!price) return null;
  const wasPrice = prices.length > 1 && prices[0] > price ? prices[0] : undefined;

  const promoText = lines.slice(1).find((l) => l !== priceLine && PROMO_RE.test(l) && !/^\(\d+\)$/.test(l));
  const promo = parsePromo(promoText);

  const category: Category = /\bbaby|nappy|nappies|formula\b/i.test(name) ? 'baby' : 'grocery';
  return {
    store: 'woolworths',
    id: slug(name),
    name,
    brand,
    size: name.match(SIZE_RE)?.[1],
    price,
    wasPrice,
    promo,
    effectivePrice: Math.round(effectivePrice(price, promo) * 100) / 100,
    url: `${SEARCH}${encodeURIComponent(name)}`,
    image: card.image,
    category,
    scrapedAt,
  };
}

export const woolworths: StoreAdapter = {
  store: 'woolworths',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      for (const term of activeTerms) {
        for (let pageNo = 1; pageNo <= MAX_PAGES_PER_TERM; pageNo++) {
          await page.goto(`${SEARCH}${encodeURIComponent(term)}&page=${pageNo}`, { waitUntil: 'domcontentloaded' });
          const found = await page.waitForSelector('article', { timeout: 20_000 }).then(() => true, () => false);
          if (!found) break;
          const cards: CardText[] = await page.evaluate(() =>
            [...document.querySelectorAll('article')].map((a) => ({
              lines: (a as HTMLElement).innerText.split('\n'),
              image: a.querySelector('img')?.getAttribute('src') ?? undefined,
            })),
          );
          for (const card of cards) {
            const p = mapCard(card, scrapedAt);
            if (p) byId.set(p.id, p);
          }
          await sleep(DELAY_MS);
          if (cards.length < 24) break;
        }
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
};
