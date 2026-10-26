import { describe, expect, it } from 'vitest';
import { mapCard } from '../src/stores/woolworths.ts';

const NOW = '2026-10-26T12:00:00.000Z';
const card = (text: string) => ({ lines: text.split(' | ') });

describe('woolworths mapCard', () => {
  it('maps a "buy any 3 for 2" card to a third off', () => {
    const p = mapCard(
      card('Lindt Extra Creamy Hazelnut Smooth Milk Chocolate Slab 80 g | (4) | BUY ANY 3 FOR 2 WOOLIES AND LINDT CHOCOLATES | R 84.99'),
      NOW,
    )!;
    expect(p.store).toBe('woolworths');
    expect(p.price).toBe(84.99);
    expect(p.promo).toMatchObject({ kind: 'free', qty: 3, payFor: 2 });
    expect(p.effectivePrice).toBeCloseTo(56.66, 2);
    expect(p.size).toBe('80 g');
  });

  it('reads was/now prices', () => {
    const p = mapCard(card('Long Life Full Cream Milk 6 x 1 L | (484) | R126.99R99.99'), NOW)!;
    expect(p.price).toBe(99.99);
    expect(p.wasPrice).toBe(126.99);
    expect(p.promo.kind).toBe('none');
  });

  it('does not treat the review count as a promo', () => {
    const p = mapCard(card('Fresh Full Cream Milk 2 L | (36) | R 38.99'), NOW)!;
    expect(p.promo.kind).toBe('none');
    expect(p.effectivePrice).toBe(38.99);
  });

  it('uses the line after an all-caps brand line as the name', () => {
    const p = mapCard(card('AYRSHIRE | Fresh Full Cream Ayrshire Milk 2 L | (33) | R 45.99'), NOW)!;
    expect(p.brand).toBe('AYRSHIRE');
    expect(p.name).toBe('Fresh Full Cream Ayrshire Milk 2 L');
    expect(p.size).toBe('2 L');
  });

  it('skips cards without a price', () => {
    expect(mapCard(card('Something | (3)'), NOW)).toBeNull();
  });
});
