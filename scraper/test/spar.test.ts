import { describe, expect, it } from 'vitest';
import { mapCard, parseValidUntil } from '../src/stores/spar.ts';

const NOW = '2026-10-26T12:00:00.000Z';
const card = (text: string) => ({ lines: text.split(' | ') });

describe('spar parseValidUntil', () => {
  it('reads "valid until [07 Dec]" as the next 7 December', () => {
    expect(parseValidUntil('Promotions valid until [07 Dec].', new Date(NOW))).toBe('2026-12-07');
  });
  it('rolls over to next year when the date has passed', () => {
    expect(parseValidUntil('valid until [05 Jan]', new Date(NOW))).toBe('2027-01-05');
  });
  it('returns undefined without a date', () => {
    expect(parseValidUntil('no dates here', new Date(NOW))).toBeUndefined();
  });
});

describe('spar mapCard', () => {
  it('maps a plain special with a saving to a was-price', () => {
    const p = mapCard(card('Save R 15.00 | SPAR Long Life Full Cream Milk (6x1L) | 1 L | R 89.99'), NOW, '2026-12-07')!;
    expect(p.store).toBe('spar');
    expect(p.price).toBe(89.99);
    expect(p.wasPrice).toBeCloseTo(104.99, 2);
    expect(p.promo.kind).toBe('none');
    expect(p.promoEnds).toBe('2026-12-07');
    expect(p.size).toBe('1 L');
  });

  it('maps "Buy Any 2" to a 2-for-R100 deal with the original unit price', () => {
    const p = mapCard(card("Save R 54.00 | OLA Rich 'n Creamy Ice Cream, Vanilla Flavoured (1.8L) | 1.8 L | Buy Any 2 | R 100.00"), NOW)!;
    expect(p.promo).toMatchObject({ kind: 'price', qty: 2, total: 100 });
    expect(p.price).toBe(77);
    expect(p.effectivePrice).toBe(50);
  });

  it('handles "Buy Any 2 for" followed by the total', () => {
    const p = mapCard(card('Save R 30.00 | Black Cat Crunchy Peanut Butter (400g) | 400 g | Buy Any 2 for | R 70.00'), NOW)!;
    expect(p.promo).toMatchObject({ kind: 'price', qty: 2, total: 70 });
    expect(p.price).toBe(50);
    expect(p.effectivePrice).toBe(35);
  });

  it('skips cards without a price', () => {
    expect(mapCard(card('Save R 10.00 | Something'), NOW)).toBeNull();
  });
});
