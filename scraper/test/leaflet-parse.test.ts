import { describe, expect, it } from 'vitest';
import { mapLeafletCard, parseCards } from '../src/leaflet.ts';

// Trimmed from a real cataloguespecials.co.za listing page (Nov 2026).
const HTML = `<div><a class="js-offer-link-item grid__row-item " href="/view/specials/checkers-catalogue-3896641?offer=70494982#page=1" title="x" data-offer-id="70494982"><div class="product"><div class="product__top gap-1"><div class="store-image"><img alt="Checkers" src="https://img.offers-cdn.net/assets/uploads/stores/za/logos/200x72_webp/checkers.webp" /></div><div class="shopping-list-btn"><button class="btn"><img src="https://img.offers-cdn.net/x/icons/list-add.svg"></button></div></div><div class="product__image "><picture><img alt="" src="https://img.offers-cdn.net/assets/uploads/offers/za/70494982/boerewors.jpeg" /></picture></div><div class="product__bottom"><h3 class="product__name txt-title"> Championship Bulk Boerewors &amp; Chops </h3><div class="product__details"><div class="product__meta txt-lighter"><div class="product-date txt-xs"> 5 days </div></div><div class="product__price"><div class="d-flex"><span class="badge">SAVE 20</span></div><div class="product__price-old"> R 139,99 </div><div class="product__price-offer m-0 quality-price--none"> R 119,99 </div></div></div></div></div></a>
<a class="other" href="/elsewhere">not a card</a></div>`;

describe('parseCards', () => {
  it('reads each offer card as text lines, link and product image', () => {
    const cards = parseCards(HTML);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      href: '/view/specials/checkers-catalogue-3896641?offer=70494982#page=1',
      lines: ['Championship Bulk Boerewors & Chops', '5 days', 'SAVE 20', 'R 139,99', 'R 119,99'],
      image: 'https://img.offers-cdn.net/assets/uploads/offers/za/70494982/boerewors.jpeg',
    });
  });

  it('feeds the card mapper', () => {
    const p = mapLeafletCard(parseCards(HTML)[0], 'checkers', '2026-11-17T12:00:00.000Z')!;
    expect(p).toMatchObject({ id: '70494982', name: 'Championship Bulk Boerewors & Chops', price: 119.99, wasPrice: 139.99, promoEnds: '2026-11-22' });
  });

  it('finds no cards on a bot-check page', () => {
    expect(parseCards('<html><title>Just a moment...</title><body>Performing security verification</body></html>')).toEqual([]);
  });
});
