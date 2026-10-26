import { chromium } from 'playwright';
import { effectivePrice, parsePromo } from '../../../shared/promo.ts';
import type { Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';

const URL = 'https://www.spar.co.za/national-specials';

export interface CardText {
  /** innerText of one special card, split into lines */
  lines: string[];
  image?: string;
}

const RAND = /^R\s?(\d[\d\s]*\.\d{2})$/;
const toNumber = (s: string) => parseFloat(s.replace(/R|\s/g, ''));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "Promotions valid until [07 Dec]." has no year; assume the next occurrence of that date. */
export function parseValidUntil(text: string, now: Date): string | undefined {
  const m = text.match(/valid until\s*\[?\s*(\d{1,2})\s+([A-Za-z]{3,})/i);
  if (!m) return undefined;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].slice(0, 3).toLowerCase());
  if (month < 0) return undefined;
  let year = now.getUTCFullYear();
  if (Date.UTC(year, month, +m[1]) < now.getTime() - 86_400_000) year++;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}

/**
 * Card lines look like: Save R 54.00 | name | 1.8 L | [Buy Any 2 [for]] | R 100.00
 * With a "Buy Any N" line the price is the total for N items; otherwise it is the special price.
 */
export function mapCard(card: CardText, scrapedAt: string, ends?: string): Product | null {
  const lines = card.lines.map((l) => l.trim()).filter(Boolean);
  const priceLine = lines.find((l) => RAND.test(l));
  const saveLine = lines.find((l) => /^Save R/i.test(l));
  const buyLine = lines.find((l) => /^Buy\b/i.test(l));
  const rest = lines.filter((l) => l !== priceLine && l !== saveLine && l !== buyLine);
  const name = rest[0];
  if (!name || !priceLine) return null;

  const shown = toNumber(priceLine);
  const saving = saveLine ? toNumber(saveLine.replace(/^Save/i, '')) : 0;
  const promoText = buyLine ? `${buyLine.replace(/\s*for$/i, '')} for R${shown}` : undefined;
  const promo = parsePromo(promoText);
  const qty = 'qty' in promo ? promo.qty : 1;
  const price = promo.kind === 'price' ? Math.round((shown / qty) * 100) / 100 : shown;
  const wasPrice = saving > 0 ? Math.round(((shown + saving) / qty) * 100) / 100 : undefined;
  return {
    store: 'spar',
    id: slug(name),
    name,
    size: rest[1],
    price: promo.kind === 'price' ? wasPrice ?? price : price,
    wasPrice: promo.kind === 'price' ? undefined : wasPrice,
    promo,
    promoEnds: ends,
    effectivePrice: Math.round(effectivePrice(promo.kind === 'price' ? wasPrice ?? price : price, promo) * 100) / 100,
    url: URL,
    image: card.image,
    category: 'grocery',
    scrapedAt,
  };
}

export const spar: StoreAdapter = {
  store: 'spar',
  async run() {
    const now = new Date();
    const scrapedAt = now.toISOString();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('img', { timeout: 20_000 });
      await page.waitForTimeout(5000);
      const ends = parseValidUntil(await page.locator('body').innerText(), now);
      const cards: CardText[] = await page.evaluate(() => {
        const isPrice = (s: string) => /^R\s?\d[\d\s]*\.\d{2}$/.test(s);
        // The card also holds a small Rewards badge; the product photo is the wide image.
        const photo = (el: Element) => [...el.querySelectorAll('img')].find((i) => i.getBoundingClientRect().width > 100);
        const out = new Map<HTMLElement, string[]>();
        const leaves = [...document.querySelectorAll<HTMLElement>('body *')].filter((e) => e.children.length === 0 && isPrice((e.innerText || '').trim()));
        for (const leaf of leaves) {
          let c: HTMLElement | null = leaf;
          for (let i = 0; i < 8 && c; i++) {
            const lines = (c.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean);
            if (lines.length >= 3 && lines.filter(isPrice).length === 1 && photo(c)) {
              out.set(c, lines);
              break;
            }
            c = c.parentElement;
          }
        }
        return [...out.entries()].map(([el, lines]) => ({ lines, image: photo(el)?.src }));
      });
      const byId = new Map<string, Product>();
      for (const card of cards) {
        const p = mapCard(card, scrapedAt, ends);
        if (p) byId.set(p.id, p);
      }
      return [...byId.values()];
    } finally {
      await browser.close();
    }
  },
};
