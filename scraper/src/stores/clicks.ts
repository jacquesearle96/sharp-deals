import { chromium, type Page } from 'playwright';
import { effectivePrice, parsePromo } from '../../../shared/promo.ts';
import type { Category, Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { sleep } from '../http.ts';

const ORIGIN = 'https://clicks.co.za';
const PAGE_COUNT = 80;
const MAX_PAGES_PER_LISTING = 6;
const MAX_DETAIL_LOOKUPS = 150;
const DELAY_MS = 1000;

/** The site's own "on promotion" listings, one per department. */
const LISTINGS: { path: string; category: Category }[] = [
  {
    path: '/health-and-pharmacy/c/OH10005?q=%3Arelevance%3ApromoStickerplp%3A2%3ApromoStickerplp%3A1%3ApromoStickerplp%3A7%3ApromoStickerplp%3A3%3ApromoStickerplp%3A10%3ApromoStickerplp%3A5%3ApromoStickerplp%3A4',
    category: 'health',
  },
  {
    path: '/toiletries/c/OH10010?q=%3Arelevance%3ApromoStickerplp%3A1%3ApromoStickerplp%3A2%3ApromoStickerplp%3A7%3ApromoStickerplp%3A3%3ApromoStickerplp%3A4',
    category: 'health',
  },
  {
    path: '/beauty/c/OH10001?q=%3Arelevance%3ApromoStickerplp%3A2%3ApromoStickerplp%3A1%3ApromoStickerplp%3A7%3ApromoStickerplp%3A6%3ApromoStickerplp%3A3%3ApromoStickerplp%3A4',
    category: 'health',
  },
  {
    path: '/products/c/OH1?q=%3Arelevance%3Acategory%3AOH10008%3ApromoStickerplp%3A3%3ApromoStickerplp%3A7%3ApromoStickerplp%3A1',
    category: 'baby',
  },
];

export interface Tile {
  href: string;
  /** innerText lines of the tile */
  lines: string[];
  /** file names of the "Clicks Promo" sticker images, e.g. "3for2.png" */
  stickers: string[];
  image?: string;
}

const PRICE_RE = /^R\s?(\d[\d\s]*\.\d{2})$/;

/** Maps a sticker image to promo text. Unknown stickers carry no usable deal. */
export function stickerPromo(stickers: string[]): string | undefined {
  for (const s of stickers) {
    const name = s.replace(/\.\w+$/, '').toLowerCase();
    if (name === '3for2') return '3 for 2';
    const save = name.match(/^save(\d+)$/);
    if (save) return `Save ${save[1]}%`;
  }
  return undefined;
}

/** The detail page states the real deal in a sentence like "save per offer 2for 50". */
export function promoFromPageText(text: string): string | undefined {
  return text.split('\n').map((l) => l.trim()).find((l) => /\d\s?for\s?r?\s?\d|\bsave \d+%|buy \d/i.test(l) && l.length < 200);
}

export function mapTile(tile: Tile, promoText: string | undefined, scrapedAt: string, category: Category): Product | null {
  const lines = tile.lines.map((l) => l.trim()).filter(Boolean);
  const priceIdx = lines.findIndex((l) => PRICE_RE.test(l));
  if (priceIdx < 1) return null;
  const price = parseFloat(lines[priceIdx].match(PRICE_RE)![1].replace(/\s/g, ''));
  const head = lines.slice(0, priceIdx).filter((l) => !/^see more variants$/i.test(l));
  if (head.length === 0) return null;
  const brand = head.length > 1 ? head[0] : undefined;
  const name = head.join(' ');
  const promo = parsePromo(promoText);
  const id = tile.href.match(/\/p\/(\d+)/)?.[1] ?? tile.href;
  return {
    store: 'clicks',
    id,
    name,
    brand,
    price,
    promo,
    effectivePrice: Math.round(effectivePrice(price, promo) * 100) / 100,
    url: tile.href.startsWith('http') ? tile.href : ORIGIN + tile.href,
    image: tile.image,
    category,
    scrapedAt,
  };
}

async function readTiles(page: Page): Promise<Tile[]> {
  return page.evaluate(() => {
    const seen = new Set<string>();
    const out: Tile[] = [];
    for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"]')) {
      let c: HTMLElement | null = a;
      for (let i = 0; i < 6 && c; i++) {
        if (/R\s?\d/.test(c.innerText) && c.querySelectorAll('a[href*="/p/"]').length <= 3) break;
        c = c.parentElement;
      }
      const href = a.getAttribute('href')!;
      if (!c || seen.has(href) || !/R\s?\d/.test(c.innerText)) continue;
      seen.add(href);
      out.push({
        href,
        lines: c.innerText.split('\n'),
        stickers: [...c.querySelectorAll('img[alt="Clicks Promo"]')].map((i) => (i.getAttribute('src') ?? '').split('?')[0].split('/').pop() ?? ''),
        image: c.querySelector('img[alt]:not([alt="Clicks Promo"])')?.getAttribute('src') ?? undefined,
      });
    }
    return out;
  });
}

export const clicks: StoreAdapter = {
  store: 'clicks',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const needDetail: { tile: Tile; category: Category }[] = [];
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      for (const { path, category } of LISTINGS) {
        for (let pageNo = 0; pageNo < MAX_PAGES_PER_LISTING; pageNo++) {
          await page.goto(`${ORIGIN}${path}&text=&count=${PAGE_COUNT}&page=${pageNo}`, { waitUntil: 'domcontentloaded' });
          const found = await page.waitForSelector('a[href*="/p/"]', { timeout: 20_000 }).then(() => true, () => false);
          if (!found) break;
          const tiles = await readTiles(page);
          let added = 0;
          for (const tile of tiles) {
            if (byId.has(tile.href.match(/\/p\/(\d+)/)?.[1] ?? tile.href)) continue;
            const text = stickerPromo(tile.stickers);
            if (!text && tile.stickers.some((s) => /bulk/i.test(s))) needDetail.push({ tile, category });
            const p = mapTile(tile, text, scrapedAt, category);
            if (p) {
              byId.set(p.id, p);
              added++;
            }
          }
          await sleep(DELAY_MS);
          if (added === 0) break;
        }
      }

      // "bulk" stickers only say a multi-buy exists; the product page has the actual terms.
      for (const { tile, category } of needDetail.slice(0, MAX_DETAIL_LOOKUPS)) {
        await page.goto(ORIGIN + tile.href, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const text = promoFromPageText(await page.locator('body').innerText());
        const p = mapTile(tile, text, scrapedAt, category);
        if (p) byId.set(p.id, p);
        await sleep(DELAY_MS);
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
};
