import { describe, expect, it } from 'vitest';
import { keepUnexpired, mapLeafletCard } from '../src/leaflet.ts';

const NOW = '2026-10-26T12:00:00.000Z';
const card = (text: string, href = '/view/specials/food-lover-s-market-catalogue-3871000?offer=70001#page=2') => ({ lines: text.split(' | '), href });

describe('food lover\'s market via the leaflet reader', () => {
  it('tags the store and reads the was-price and saving', () => {
    const p = mapLeafletCard(card('SAVE R50 | Food lover\'s market - food lover\'s olive oil | 6 days | R 149,99 | R 99,99'), 'foodlovers', NOW)!;
    expect(p.store).toBe('foodlovers');
    expect(p.id).toBe('70001');
    expect(p.price).toBe(99.99);
    expect(p.wasPrice).toBe(149.99);
    expect(p.promoEnds).toBe('2026-11-01');
    expect(p.category).toBe('grocery');
    expect(p.url).toContain('cataloguespecials.co.za');
  });

  it('handles a lower-case save badge', () => {
    const p = mapLeafletCard(card('save R30 | 2-ply toilet paper | 6 days | R 129,95 | R 99,95'), 'foodlovers', NOW)!;
    expect(p.name).toBe('2-ply toilet paper');
    expect(p.wasPrice).toBe(129.95);
  });

  it('keeps a single-price combo with no was-price', () => {
    const p = mapLeafletCard(card('Combo: potato, onion, carrot, tomato | 6 days | R 199,00'), 'foodlovers', NOW)!;
    expect(p.price).toBe(199);
    expect(p.wasPrice).toBeUndefined();
    expect(p.name).toContain('Combo');
  });
});

describe('every leaflet item counts as a deal', () => {
  it('marks an item with no was-price as a special, without inventing a saving', () => {
    const p = mapLeafletCard({ lines: ['Blueberry bags', '6 days', 'R 79,00'], href: '/v?offer=5' }, 'foodlovers', '2026-10-26T12:00:00.000Z')!;
    expect(p.promo).toMatchObject({ kind: 'discount', raw: 'In the leaflet' });
    expect(p.wasPrice).toBeUndefined();
    expect(p.effectivePrice).toBe(79);
  });
});

describe('leaflet ids', () => {
  it('reads the offer number from both link styles', () => {
    expect(mapLeafletCard(card('Blueberry punnet | 6 days | R 39,99'), 'foodlovers', NOW)!.id).toBe('70001');
    const p = mapLeafletCard(card('Blueberry punnet | 6 days | R 39,99', '/stores/food-lover-s-market/specials/blueberry-punnet-offer-69986367/'), 'foodlovers', NOW)!;
    expect(p.id).toBe('69986367');
  });
});

describe('keepUnexpired', () => {
  const item = (id: string, promoEnds?: string) => ({ ...mapLeafletCard(card(`Item ${id} | R 10,00`), 'foodlovers', NOW)!, id, promoEnds });

  it('keeps items a failed page missed while their leaflet is still running', () => {
    const previous = [item('a', '2026-11-08'), item('b', '2026-11-02'), item('c', '2026-11-01'), item('d')];
    const fresh = [item('a', '2026-11-08'), item('e', '2026-11-08')];
    expect(keepUnexpired(previous, fresh, '2026-11-02').map((p) => p.id)).toEqual(['b']);
  });
});
