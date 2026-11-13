import { chromium } from 'playwright';
import type { Ps5Offer, Ps5StoreId } from '../../../shared/ps5.ts';
import { requestJson, requestText, sleep, UA } from '../http.ts';

/**
 * TEMPORARY (Black Friday 2026). One small reader per store for PlayStation 5 listings.
 * Each reads only what the store's robots.txt allows: an API or JSON feed where the store offers one,
 * otherwise its console category page (several stores ask crawlers to stay out of their search pages).
 * Readers return every listing they see; run.ts keeps the ones that look like PS5 consoles.
 */
export type Listing = Omit<Ps5Offer, 'store'>;
export type Source = { store: Ps5StoreId; read: () => Promise<Listing[]> };

const DELAY_MS = 1500;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&#8217;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const rand = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const was = (price: number, before: number | undefined) => (before && before > price ? before : undefined);

// ---------- Takealot: the public product API (its robots.txt allows the search endpoint) ----------

interface TakealotSearch {
  sections: {
    products: {
      results: {
        product_views: {
          core: { id: number; title: string; slug: string };
          buybox_summary?: { prices?: number[]; listing_price?: number | null };
          stock_availability_summary?: { status?: string };
        };
      }[];
      paging: { next_is_after?: string };
    };
  };
}

async function takealot(): Promise<Listing[]> {
  const out: Listing[] = [];
  let after = '';
  for (let page = 0; page < 3; page++) {
    const url = `https://api.takealot.com/rest/v-1-14-0/searches/products?qsearch=playstation%205%20console${after ? `&after=${after}` : ''}`;
    const data = await requestJson<TakealotSearch>(url);
    for (const r of data.sections.products.results) {
      const { core, buybox_summary: buy, stock_availability_summary: stock } = r.product_views;
      const price = buy?.prices?.[0];
      if (!price) continue;
      out.push({
        name: core.title,
        price,
        wasPrice: was(price, buy?.listing_price ?? undefined),
        url: `https://www.takealot.com/${core.slug}/PLID${core.id}`,
        inStock: stock?.status ? !/out of stock|unavailable/i.test(stock.status) : undefined,
      });
    }
    after = data.sections.products.paging.next_is_after ?? '';
    if (!after) break;
    await sleep(DELAY_MS);
  }
  return out;
}

// ---------- Amazon.co.za: the search results page ----------

export function parseAmazon(html: string): Listing[] {
  const out: Listing[] = [];
  const parts = html.split('data-component-type="s-search-result"').slice(1);
  for (const p of parts) {
    const name = p.match(/<h2[^>]*aria-label="([^"]*)"/)?.[1] ?? p.match(/<h2[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/)?.[1];
    const href = p.match(/href="(\/[^"]*?\/dp\/\w+)/)?.[1];
    const price = rand(p.match(/<span class="a-price"[^>]*><span class="a-offscreen">([^<]*)</)?.[1] ?? p.match(/<span class="a-offscreen">([^<]*)</)?.[1]);
    const before = rand(p.match(/a-text-price"[^>]*><span class="a-offscreen">([^<]*)</)?.[1]);
    if (!name || !href || !price) continue;
    out.push({ name: decode(name), price, wasPrice: was(price, before), url: `https://www.amazon.co.za${href}` });
  }
  return out;
}

async function amazon(): Promise<Listing[]> {
  const html = await requestText('https://www.amazon.co.za/s?k=playstation+5+console');
  const found = parseAmazon(html);
  if (found.length === 0 && /captcha/i.test(html)) throw new Error('Amazon showed a robot check instead of results');
  return found;
}

// ---------- Game: the JSON API behind its Consoles category ----------

interface GameSearch {
  products?: {
    name: string;
    url: string;
    price: { value: number };
    stock?: { stockLevelStatus?: string };
  }[];
}

async function game(): Promise<Listing[]> {
  const data = await requestJson<GameSearch>(
    'https://www.game.co.za/occ/v2/game/channel/msite/zone/G205/category/G3102/search?fields=FULL&currentPage=0&pageSize=100',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'playstation 5' }) },
  );
  return (data.products ?? []).map((p) => ({
    name: p.name,
    price: p.price.value,
    url: `https://www.game.co.za${p.url}`,
    inStock: p.stock?.stockLevelStatus ? p.stock.stockLevelStatus !== 'outOfStock' : undefined,
  }));
}

// ---------- Magento stores (Incredible, HiFi Corp, House & Home, OK Furniture): category pages ----------

/** Reads the product tiles from a Magento listing page's HTML. */
export function parseMagento(html: string): Listing[] {
  const out: Listing[] = [];
  for (const tile of html.split('product-item-info').slice(1)) {
    const link = tile.match(/<a[^>]*class="product-item-link"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const href = link[0].match(/href="([^"]*)"/)?.[1];
    const amount = (type: string) =>
      rand(
        tile.match(new RegExp(`data-price-amount="([\\d.]+)"[^>]*data-price-type="${type}"`))?.[1] ??
          tile.match(new RegExp(`data-price-type="${type}"[^>]*data-price-amount="([\\d.]+)"`))?.[1],
      );
    const price = amount('finalPrice');
    if (!href || !price) continue;
    out.push({
      name: decode(link[1].replace(/<[^>]*>/g, '')),
      price,
      wasPrice: was(price, amount('oldPrice')),
      url: href,
      inStock: /out of stock|sold out|unavailable/i.test(tile) ? false : undefined,
    });
  }
  return out;
}

/** Walks a Magento category with ?p=N (when the store's robots.txt allows paging) until a page adds nothing. */
async function magento(url: string, maxPages: number): Promise<Listing[]> {
  const byUrl = new Map<string, Listing>();
  for (let p = 1; p <= maxPages; p++) {
    const tiles = parseMagento(await requestText(p === 1 ? url : `${url}?p=${p}`));
    const fresh = tiles.filter((t) => !byUrl.has(t.url));
    for (const t of fresh) byUrl.set(t.url, t);
    if (fresh.length === 0) break;
    if (p < maxPages) await sleep(DELAY_MS);
  }
  return [...byUrl.values()];
}

// ---------- BT Games: WooCommerce Store API, PS5 console category ----------

interface WooProduct {
  name: string;
  permalink: string;
  is_in_stock: boolean;
  prices: { price: string; regular_price: string; currency_minor_unit: number };
}

async function btgames(): Promise<Listing[]> {
  const items = await requestJson<WooProduct[]>(
    'https://www.btgames.co.za/wp-json/wc/store/v1/products?category=playstation-5-console&per_page=100',
  );
  return items.map((p) => {
    const unit = 10 ** p.prices.currency_minor_unit;
    const price = Number(p.prices.price) / unit;
    return {
      name: decode(p.name),
      price,
      wasPrice: was(price, Number(p.prices.regular_price) / unit),
      url: p.permalink,
      inStock: p.is_in_stock,
    };
  });
}

// ---------- Loot: the data embedded in its search page ----------

interface LootProduct {
  name: string;
  price: number;
  listPrice?: number;
  available?: boolean;
  shareLink?: { uri: string };
  slug: string;
  code: string;
}

export function parseLoot(html: string): Listing[] {
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error('Loot page had no product data');
  const data = JSON.parse(json) as {
    props: { pageProps: { initialState: { searchResult?: { products?: { productInfo: LootProduct }[] } } } };
  };
  return (data.props.pageProps.initialState.searchResult?.products ?? []).map(({ productInfo: p }) => ({
    name: p.name,
    price: p.price,
    wasPrice: was(p.price, p.listPrice),
    url: `https://www.loot.co.za${p.shareLink?.uri ?? `/product/${p.slug}/${p.code}`}`,
    inStock: p.available,
  }));
}

const loot = async () => parseLoot(await requestText('https://www.loot.co.za/search?terms=playstation%205%20console'));

// ---------- Computer Mania: Shopify collection feeds ----------

interface ShopifyProduct {
  title: string;
  handle: string;
  variants: { price: string; compare_at_price: string | null; available: boolean }[];
}

async function computermania(): Promise<Listing[]> {
  const byUrl = new Map<string, Listing>();
  for (const collection of ['playstation-console', 'consoles']) {
    const { products } = await requestJson<{ products: ShopifyProduct[] }>(
      `https://computermania.co.za/collections/${collection}/products.json?limit=250`,
    );
    for (const p of products) {
      const v = p.variants[0];
      if (!v) continue;
      const price = Number(v.price);
      const url = `https://computermania.co.za/products/${p.handle}`;
      byUrl.set(url, {
        name: p.title,
        price,
        wasPrice: was(price, rand(v.compare_at_price ?? undefined)),
        url,
        inStock: p.variants.some((x) => x.available),
      });
    }
    await sleep(DELAY_MS);
  }
  return [...byUrl.values()];
}

// ---------- Makro: the PS5 category, which only renders in a browser ----------

async function makro(): Promise<Listing[]> {
  // CHROMIUM_PATH: use an already installed browser instead of Playwright's own download (local testing).
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await (await browser.newContext({ userAgent: UA })).newPage();
    await page.goto('https://www.makro.co.za/gaming/gaming-consoles/ps5/pr?sid=4rr,x1m,ogz', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[data-id] a[title]', { timeout: 30_000 });
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll('[data-id]')].map((t) => {
        const a = t.querySelector('a[title]');
        // Prices show as "R 15,499" with the cents in a separate element; the first is the price, a larger one the old price.
        const prices = [...t.querySelectorAll('*')]
          .filter((e) => e.childElementCount === 0 && /^R\s?[\d,]+$/.test(e.textContent?.trim() ?? ''))
          .map((e) => {
            const cents = e.nextElementSibling?.textContent?.trim() ?? '';
            return parseFloat((e.textContent ?? '').replace(/[^\d]/g, '')) + (/^\d{2}$/.test(cents) ? Number(cents) / 100 : 0);
          });
        return {
          name: a?.getAttribute('title') ?? '',
          href: a?.getAttribute('href') ?? '',
          prices,
          soldOut: /out of stock|sold out|currently unavailable/i.test((t as HTMLElement).innerText),
        };
      }),
    );
    return tiles
      .filter((t) => t.name && t.href && t.prices[0])
      .map((t) => ({
        name: t.name,
        price: t.prices[0],
        wasPrice: was(t.prices[0], t.prices.find((p) => p > t.prices[0])),
        // Drop the tracking query string; the product address works without it.
        url: `https://www.makro.co.za${t.href.replace(/\?.*$/, '')}`,
        inStock: t.soldOut ? false : undefined,
      }));
  } finally {
    await browser.close();
  }
}

export const SOURCES: Source[] = [
  { store: 'takealot', read: takealot },
  { store: 'amazon', read: amazon },
  { store: 'game', read: game },
  { store: 'makro', read: makro },
  // Incredible and HiFi Corp allow ?p= paging but not their search pages.
  { store: 'incredible', read: () => magento('https://www.incredible.co.za/products/gaming/consoles', 4) },
  { store: 'hificorp', read: () => magento('https://www.hificorp.co.za/products/gaming/consoles', 4) },
  { store: 'btgames', read: btgames },
  { store: 'loot', read: loot },
  { store: 'houseandhome', read: () => magento('https://www.houseandhome.co.za/products/gaming/gaming-consoles', 3) },
  // OK Furniture's robots.txt disallows any address with "?", so only the first page of its Gaming department.
  { store: 'okfurniture', read: () => magento('https://www.okfurniture.co.za/gaming', 1) },
  { store: 'computermania', read: computermania },
];
