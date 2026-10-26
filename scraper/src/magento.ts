import type { Page } from 'playwright';
import { effectivePrice, parsePromo } from '../../shared/promo.ts';
import type { Category, Product, StoreId } from '../../shared/types.ts';
import { sleep } from './http.ts';

/** One product tile from a Magento listing page. */
export interface MagentoTile {
  name: string;
  href: string;
  /** current price in rand */
  price: number;
  /** price before the special, in rand */
  oldPrice?: number;
  image?: string;
}

const slug = (href: string) => href.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() ?? href;

export function mapMagentoTile(
  tile: MagentoTile,
  store: StoreId,
  category: Category,
  scrapedAt: string,
  promoText?: string,
): Product | null {
  if (!tile.name || !(tile.price > 0)) return null;
  const promo = parsePromo(promoText);
  return {
    store,
    id: slug(tile.href),
    name: tile.name,
    price: tile.price,
    wasPrice: tile.oldPrice && tile.oldPrice > tile.price ? tile.oldPrice : undefined,
    promo,
    effectivePrice: Math.round(effectivePrice(tile.price, promo) * 100) / 100,
    url: tile.href,
    image: tile.image,
    category,
    scrapedAt,
  };
}

/** Reads every product tile on a Magento category or search page. */
export function readMagentoTiles(page: Page): Promise<MagentoTile[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('li.product-item')].map((t) => {
      const link = t.querySelector('a.product-item-link, .product-item-link a, a.product-item-photo, a');
      const imgs = [...t.querySelectorAll('img')].map((i) => i.getAttribute('src') ?? '');
      return {
        name: (t.querySelector('.product-item-link')?.textContent ?? '').trim(),
        href: link?.getAttribute('href') ?? '',
        price: parseFloat(t.querySelector('[data-price-type="finalPrice"]')?.getAttribute('data-price-amount') ?? '0'),
        oldPrice: parseFloat(t.querySelector('[data-price-type="oldPrice"]')?.getAttribute('data-price-amount') ?? '0') || undefined,
        image: t.querySelector('img.product-image-photo')?.getAttribute('src') ?? imgs.find((s) => /^https?:/.test(s)),
      };
    }),
  );
}

/** Walks a Magento listing with `?p=N`, stopping when a page adds nothing new. */
export async function crawlMagentoListing(
  page: Page,
  url: string,
  seen: Set<string>,
  opts: { maxPages: number; delayMs: number },
): Promise<MagentoTile[]> {
  const out: MagentoTile[] = [];
  for (let p = 1; p <= opts.maxPages; p++) {
    await page.goto(`${url}${url.includes('?') ? '&' : '?'}p=${p}`, { waitUntil: 'domcontentloaded' });
    const found = await page.waitForSelector('li.product-item', { timeout: 20_000 }).then(() => true, () => false);
    if (!found) break;
    const fresh = (await readMagentoTiles(page)).filter((t) => t.href && !seen.has(t.href));
    if (fresh.length === 0) break;
    for (const t of fresh) seen.add(t.href);
    out.push(...fresh);
    await sleep(opts.delayMs);
  }
  return out;
}
