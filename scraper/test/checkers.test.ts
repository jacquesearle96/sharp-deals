import { describe, expect, it } from 'vitest';
import { endDate, mapCard } from '../src/stores/checkers.ts';

const NOW = '2026-10-26T12:00:00.000Z';
const card = (text: string, href = '/view/specials/checkers-catalogue-3859020?offer=69265125#page=1') => ({
  lines: text.split(' | '),
  href,
});

describe('checkers endDate', () => {
  it('adds the days left to today', () => {
    expect(endDate('13 days', new Date(NOW))).toBe('2026-11-08');
    expect(endDate('1 day', new Date(NOW))).toBe('2026-10-27');
  });
  it('ignores other text', () => {
    expect(endDate('Ends soon', new Date(NOW))).toBeUndefined();
    expect(endDate(undefined, new Date(NOW))).toBeUndefined();
  });
});

describe('checkers mapCard', () => {
  it('reads old and offer price from a SAVE card', () => {
    const p = mapCard(card('SAVE 60 | Housebrand 2-Ply Toilet Rolls | 13 days | R 260,00 | R 200,00'), NOW)!;
    expect(p.store).toBe('checkers');
    expect(p.id).toBe('69265125');
    expect(p.name).toBe('Housebrand 2-Ply Toilet Rolls');
    expect(p.price).toBe(200);
    expect(p.wasPrice).toBe(260);
    expect(p.promo.kind).toBe('none');
    expect(p.effectivePrice).toBe(200);
    expect(p.promoEnds).toBe('2026-11-08');
    expect(p.url).toBe('https://www.cataloguespecials.co.za/view/specials/checkers-catalogue-3859020?offer=69265125#page=1');
  });

  it('handles a card with a single price and decimal comma', () => {
    const p = mapCard(card('Wedgewood Nougat 120g/130g/140g | 13 days | R 89,99', '/view/specials/x?offer=7'), NOW)!;
    expect(p.price).toBe(89.99);
    expect(p.wasPrice).toBeUndefined();
  });

  it('does not double-apply a percentage SAVE badge', () => {
    const p = mapCard(card('SAVE 20% | Some Product 500g | 5 days | R 100,00 | R 80,00', '/v?offer=8'), NOW)!;
    expect(p.promo.kind).toBe('none');
    expect(p.effectivePrice).toBe(80);
  });

  it('picks up a real multi-buy in the name', () => {
    const p = mapCard(card('Coke 2L 2 for R50 | 3 days | R 32,99', '/v?offer=9'), NOW)!;
    expect(p.promo).toMatchObject({ kind: 'price', qty: 2, total: 50 });
    expect(p.effectivePrice).toBe(25);
  });

  it('skips cards without a price', () => {
    expect(mapCard(card('SAVE 5 | Mystery | 2 days'), NOW)).toBeNull();
  });
});
