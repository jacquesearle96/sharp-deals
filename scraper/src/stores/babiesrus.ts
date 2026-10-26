import { chromium } from 'playwright';
import type { Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { crawlMagentoListing, mapMagentoTile } from '../magento.ts';

const ORIGIN = 'https://www.babiesrus.co.za';
const MAX_PAGES_PER_LISTING = 15;
const DELAY_MS = 1500;

/**
 * Department and promotion pages only: the shop's robots.txt asks crawlers to stay out of /search and /api.
 */
export const DEPARTMENTS = [
  'clothing-accessories',
  'monitors-baby-proofing',
  'car-seats-travel-accessories',
  'nappies-changing',
  'prams-strollers',
  'baby-gear',
  'breast-feeding',
  'infant-food-feeding',
  'bottles-dummies',
  'health-medical',
  'pushbikes-scooters',
  'maternity-pregnancy',
  'baby-shower-gifts',
].map((d) => `/shop-by-department/${d}`);

/** Promotion pages that list discounted products. Multi-buy deals are named in the page slug. */
export const PROMO_PAGES = ['/promotions/view-all-deals', '/dynamite-deals', '/promotions/clearance', '/promotions/bundles', '/promotions/3-for-2-baby-wipes'];

/** "/promotions/3-for-2-baby-wipes" is a 3 for 2 deal; other promo pages carry no multi-buy. */
export function promoFromPath(path: string): string | undefined {
  const m = path.match(/\/(\d+)-for-(r?\d+)(?:-|$)/i);
  return m ? `${m[1]} for ${m[2]}` : undefined;
}

export const babiesrus: StoreAdapter = {
  store: 'babiesrus',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const opts = { maxPages: MAX_PAGES_PER_LISTING, delayMs: DELAY_MS };

      for (const path of DEPARTMENTS) {
        for (const tile of await crawlMagentoListing(page, ORIGIN + path, new Set(), opts)) {
          const p = mapMagentoTile(tile, 'babiesrus', 'baby', scrapedAt);
          if (p && !byId.has(p.id)) byId.set(p.id, p);
        }
      }

      // Promo pages run last: they carry the was-prices and multi-buy terms for products already listed.
      for (const path of PROMO_PAGES) {
        const promoText = promoFromPath(path);
        for (const tile of await crawlMagentoListing(page, ORIGIN + path, new Set(), opts)) {
          const p = mapMagentoTile(tile, 'babiesrus', 'baby', scrapedAt, promoText);
          if (!p) continue;
          const before = byId.get(p.id);
          byId.set(p.id, { ...p, wasPrice: p.wasPrice ?? before?.wasPrice });
        }
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
};
