import { effectivePrice, parsePromo } from '../../../shared/promo.ts';
import { chromium, type Page } from 'playwright';
import type { Category, Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { sleep } from '../http.ts';
import { activeTerms } from '../terms.ts';

const BASE = 'https://www.pnp.co.za/pnphybris/v2/pnp-spa/products/search';
/** Cape Town store; prices and promos are per store. */
const STORE_CODE = 'WC21';
const PAGE_SIZE = 72;
const MAX_PAGES_PER_TERM = 5;
const DELAY_MS = 800;

const FIELDS =
  'products(code,name,price(FULL),images(DEFAULT),available,potentialPromotions(FULL),categoryNames),pagination(DEFAULT)';


interface RawProduct {
  code: string;
  name: string;
  available?: boolean;
  categoryNames?: string[];
  images?: { format: string; url: string }[];
  price?: { value: number; oldPrice?: number };
  potentialPromotions?: { promotionTextMessage?: string; endDate?: string }[];
}

interface SearchResponse {
  products?: RawProduct[];
  pagination?: { totalPages: number };
}

const SIZE_RE = /(\d+(?:\.\d+)?\s?(?:g|kg|ml|l|ea|pk|pack|s))\s*$/i;

export function mapProduct(raw: RawProduct, scrapedAt: string): Product | null {
  if (!raw.price?.value || raw.available === false) return null;
  const promoInfo = raw.potentialPromotions?.find((p) => p.promotionTextMessage?.trim());
  const promo = parsePromo(promoInfo?.promotionTextMessage);
  const price = raw.price.value;
  const image = raw.images?.find((i) => i.format === 'product')?.url;
  const category: Category = raw.categoryNames?.some((c) => /baby/i.test(c)) ? 'baby' : 'grocery';
  return {
    store: 'pnp',
    id: raw.code,
    name: raw.name,
    size: raw.name.match(SIZE_RE)?.[1],
    price,
    wasPrice: raw.price.oldPrice && raw.price.oldPrice > price ? raw.price.oldPrice : undefined,
    promo,
    promoEnds: promoInfo?.endDate,
    effectivePrice: Math.round(effectivePrice(price, promo) * 100) / 100,
    url: `https://www.pnp.co.za/search/${encodeURIComponent(raw.name)}`,
    image,
    category,
    scrapedAt,
  };
}

/**
 * Runs the same request the site's own search box makes, from inside a normal
 * browser session on pnp.co.za (same origin, default browser identity).
 */
function searchInPage(page: Page, query: string, pageNo: number): Promise<SearchResponse> {
  const url =
    `${BASE}?fields=${FIELDS}&query=${encodeURIComponent(query)}&pageSize=${PAGE_SIZE}` +
    `&currentPage=${pageNo}&storeCode=${STORE_CODE}&lang=en&curr=ZAR`;
  return page.evaluate(async (u) => {
    const res = await fetch(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Pnp-Search-Session-Id': '1',
        'X-Pnp-Search-Client-Id': crypto.randomUUID(),
        'X-Pnp-Cache-Key': 'anonymous',
      },
      body: '{}',
    });
    if (!res.ok) throw new Error(`${res.status} from PnP search`);
    return res.json();
  }, url);
}

export const pnp: StoreAdapter = {
  store: 'pnp',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto('https://www.pnp.co.za/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      for (const term of activeTerms) {
        for (let pageNo = 0; pageNo < MAX_PAGES_PER_TERM; pageNo++) {
          const res = await searchInPage(page, term, pageNo);
          for (const raw of res.products ?? []) {
            const p = mapProduct(raw, scrapedAt);
            if (p) byId.set(p.id, p);
          }
          await sleep(DELAY_MS);
          if (pageNo + 1 >= (res.pagination?.totalPages ?? 0)) break;
        }
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
};
