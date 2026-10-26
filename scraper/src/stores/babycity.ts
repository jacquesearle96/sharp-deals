import { chromium } from 'playwright';
import type { Product } from '../../../shared/types.ts';
import type { StoreAdapter } from '../adapter.ts';
import { crawlMagentoListing, mapMagentoTile } from '../magento.ts';

const ORIGIN = 'https://www.babycity.co.za';
const MAX_PAGES_PER_CATEGORY = 15;
const DELAY_MS = 1500;

/**
 * Top-level departments. Their listing pages include everything in the sub-categories.
 * We browse category pages only: the shop's robots.txt asks crawlers to stay out of search and /api/.
 */
export const CATEGORIES = [
  'clothing',
  'feeding-essentials',
  'food',
  'formula',
  'health',
  'home-safety',
  'hygiene',
  'maternity',
  'nappies-wipes-accessories',
  'nursery-accessories',
  'toys-gifts',
  'travel-safety-gear',
];

export const babycity: StoreAdapter = {
  store: 'babycity',
  async run() {
    const scrapedAt = new Date().toISOString();
    const byId = new Map<string, Product>();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const seen = new Set<string>();
      for (const category of CATEGORIES) {
        const tiles = await crawlMagentoListing(page, `${ORIGIN}/shop/${category}`, seen, {
          maxPages: MAX_PAGES_PER_CATEGORY,
          delayMs: DELAY_MS,
        });
        for (const tile of tiles) {
          const p = mapMagentoTile(tile, 'babycity', 'baby', scrapedAt);
          if (p) byId.set(p.id, p);
        }
      }
    } finally {
      await browser.close();
    }
    return [...byId.values()];
  },
};
