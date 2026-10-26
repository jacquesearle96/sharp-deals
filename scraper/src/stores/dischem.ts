import { chromium, type Page } from 'playwright';
import { effectivePrice, isMultiBuy, parsePromo } from '../../../shared/promo.ts';
import type { Category, Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { sleep } from '../http.ts';

const ORIGIN = 'https://www.dischem.co.za';
const MAX_PAGES_PER_LISTING = 40;
const MAX_CAMPAIGNS = 12;
const DELAY_MS = 1000;

export interface Tile {
  name: string;
  href: string;
  /** current price in rand */
  price: number;
  /** price before the special, in rand */
  oldPrice?: number;
  image?: string;
}

export interface Campaign {
  promoText: string;
  /** ISO dates, YYYY-MM-DD */
  starts?: string;
  ends?: string;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Pulls "from Friday, 30th October, to Sunday, 1st November, 2026" into ISO dates. */
export function parseDates(text: string): { starts?: string; ends?: string } {
  const found = [...text.matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:,?\s+(\d{4}))?/g)]
    .map((m) => ({ day: +m[1], month: MONTHS.indexOf(m[2].toLowerCase()), year: m[3] ? +m[3] : undefined }))
    .filter((d) => d.month >= 0 && d.day >= 1 && d.day <= 31);
  if (found.length === 0) return {};
  const year = found.find((d) => d.year)?.year;
  if (!year) return {};
  const iso = (d: (typeof found)[number]) => `${d.year ?? year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  return found.length === 1 ? { ends: iso(found[0]) } : { starts: iso(found[0]), ends: iso(found[1]) };
}

/** Reads a campaign landing page. Only multi-buy campaigns are interesting here. */
export function parseCampaign(pageText: string): Campaign | null {
  const para = pageText
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /\d\s?\+\s?\d|buy \d|\d for \d|\d for r/i.test(l) && l.length < 600);
  if (!para) return null;
  const promo = parsePromo(para);
  if (!isMultiBuy(promo)) return null;
  const deal = para.match(/\d\s?\+\s?\d(?: cheapest)? free|buy \d+,? get \d+ free|\d+ for r?\s?\d+(?:\.\d+)?/i)?.[0] ?? '';
  const members = /better rewards/i.test(para) ? ' (Better Rewards members)' : '';
  return { promoText: deal + members, ...parseDates(para) };
}

const slug = (href: string) => href.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() ?? href;

const category = (name: string): Category => (/\bbaby|nappy|nappies|formula|avent\b/i.test(name) ? 'baby' : 'health');

export function mapTile(tile: Tile, campaign: Campaign | undefined, scrapedAt: string): Product | null {
  if (!tile.name || !(tile.price > 0)) return null;
  // Campaign terms exclude products that are already discounted.
  if (tile.oldPrice && tile.oldPrice > tile.price) campaign = undefined;
  const promo = parsePromo(campaign?.promoText);
  return {
    store: 'dischem',
    id: slug(tile.href),
    name: tile.name,
    price: tile.price,
    wasPrice: tile.oldPrice && tile.oldPrice > tile.price ? tile.oldPrice : undefined,
    promo,
    promoStarts: campaign?.starts,
    promoEnds: campaign?.ends,
    effectivePrice: Math.round(effectivePrice(tile.price, promo) * 100) / 100,
    url: tile.href,
    image: tile.image,
    category: category(tile.name),
    scrapedAt,
  };
}

async function readTiles(page: Page): Promise<Tile[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('li.product-item')].map((t) => ({
      name: t.querySelector('a.product-item-link')?.textContent?.trim() ?? '',
      href: t.querySelector('a.product-item-link')?.getAttribute('href') ?? '',
      price: parseFloat(t.querySelector('[data-price-type="finalPrice"]')?.getAttribute('data-price-amount') ?? '0'),
      oldPrice: parseFloat(t.querySelector('[data-price-type="oldPrice"]')?.getAttribute('data-price-amount') ?? '0') || undefined,
      image: t.querySelector('img.product-image-photo')?.getAttribute('src') ?? undefined,
    })),
  );
}

/** Walks a Magento listing page by page, stopping when a page adds nothing new. */
async function crawlListing(page: Page, url: string, seen: Set<string>): Promise<Tile[]> {
  const out: Tile[] = [];
  for (let p = 1; p <= MAX_PAGES_PER_LISTING; p++) {
    await page.goto(`${url}${url.includes('?') ? '&' : '?'}p=${p}`, { waitUntil: 'domcontentloaded' });
    const found = await page.waitForSelector('li.product-item', { timeout: 20_000 }).then(() => true, () => false);
    if (!found) break;
    const fresh = (await readTiles(page)).filter((t) => t.href && !seen.has(t.href));
    if (fresh.length === 0) break;
    for (const t of fresh) seen.add(t.href);
    out.push(...fresh);
    await sleep(DELAY_MS);
  }
  return out;
}

export const dischem: StoreAdapter = {
  store: 'dischem',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();

      // 1. Everything on promotion: special prices with their was-price.
      for (const tile of await crawlListing(page, `${ORIGIN}/on-promotion`, new Set())) {
        const p = mapTile(tile, undefined, scrapedAt);
        if (p) byId.set(p.id, p);
      }

      // 2. Multi-buy campaigns (e.g. "2+1 cheapest free"), which only appear on landing pages.
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      const links: string[] = await page.evaluate(() =>
        [...new Set([...document.querySelectorAll<HTMLAnchorElement>('a[href*="/promotions/"]')].map((a) => a.href.split('?')[0]))],
      );
      const campaignUrls = links.filter((l) => /\/promotions\/[^/]+$/.test(l)).slice(0, MAX_CAMPAIGNS);
      for (const url of campaignUrls) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        const campaign = parseCampaign(await page.locator('body').innerText());
        if (!campaign) continue;
        for (const tile of await crawlListing(page, url, new Set())) {
          const p = mapTile(tile, campaign, scrapedAt);
          if (p) byId.set(p.id, p);
        }
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
};
