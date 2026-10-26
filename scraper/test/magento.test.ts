import { describe, expect, it } from 'vitest';
import { mapMagentoTile } from '../src/magento.ts';
import { promoFromPath } from '../src/stores/babiesrus.ts';

const NOW = '2026-10-26T12:00:00.000Z';
const tile = { name: 'Babywombworld Wearable Breast Pump', href: 'https://www.babycity.co.za/babywombworld-wearable-breast-pump-528', price: 1299.99, image: 'https://x/y.jpg' };

describe('mapMagentoTile', () => {
  it('maps a plain tile and takes the id from the URL slug', () => {
    const p = mapMagentoTile(tile, 'babycity', 'baby', NOW)!;
    expect(p).toMatchObject({ store: 'babycity', id: 'babywombworld-wearable-breast-pump-528', price: 1299.99, category: 'baby', effectivePrice: 1299.99 });
    expect(p.wasPrice).toBeUndefined();
    expect(p.promo.kind).toBe('none');
  });
  it('keeps the was-price when it is higher', () => {
    expect(mapMagentoTile({ ...tile, price: 999.99, oldPrice: 1299.99 }, 'babiesrus', 'baby', NOW)!.wasPrice).toBe(1299.99);
    expect(mapMagentoTile({ ...tile, oldPrice: 1000 }, 'babiesrus', 'baby', NOW)!.wasPrice).toBeUndefined();
  });
  it('applies a multi-buy promo text', () => {
    const p = mapMagentoTile({ ...tile, price: 60 }, 'babiesrus', 'baby', NOW, '3 for 2')!;
    expect(p.promo).toMatchObject({ kind: 'free', qty: 3, payFor: 2 });
    expect(p.effectivePrice).toBe(40);
  });
  it('skips tiles with no price or name', () => {
    expect(mapMagentoTile({ ...tile, price: 0 }, 'babycity', 'baby', NOW)).toBeNull();
    expect(mapMagentoTile({ ...tile, name: '' }, 'babycity', 'baby', NOW)).toBeNull();
  });
});

describe('babiesrus promoFromPath', () => {
  it('reads a 3-for-2 page slug', () => {
    expect(promoFromPath('/promotions/3-for-2-baby-wipes')).toBe('3 for 2');
  });
  it('ignores pages without a multi-buy slug', () => {
    expect(promoFromPath('/promotions/clearance')).toBeUndefined();
    expect(promoFromPath('/promotions/50-off-fisher-price')).toBeUndefined();
  });
});
