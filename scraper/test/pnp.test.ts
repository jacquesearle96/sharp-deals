import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapProduct } from '../src/stores/pnp.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/pnp-search.json', import.meta.url), 'utf8'));
const NOW = '2026-10-26T12:00:00.000Z';

describe('pnp mapProduct', () => {
  it('maps a "2 For R38.00" promo to an effective price of R19', () => {
    const p = mapProduct(fixture.products[0], NOW)!;
    expect(p.store).toBe('pnp');
    expect(p.price).toBe(24.99);
    expect(p.promo).toMatchObject({ kind: 'price', qty: 2, total: 38 });
    expect(p.effectivePrice).toBe(19);
    expect(p.size).toBe('80g');
    expect(p.promoEnds).toBe('2026-11-08T21:59:59+0000');
  });

  it('keeps products without a promo at shelf price', () => {
    const p = mapProduct(fixture.products[2], NOW)!;
    expect(p.promo.kind).toBe('none');
    expect(p.effectivePrice).toBe(p.price);
  });

  it('drops unavailable or unpriced products', () => {
    expect(mapProduct({ ...fixture.products[0], available: false }, NOW)).toBeNull();
    expect(mapProduct({ ...fixture.products[0], price: { value: 0 } }, NOW)).toBeNull();
  });
});
