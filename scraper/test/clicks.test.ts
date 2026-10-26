import { describe, expect, it } from 'vitest';
import { mapTile, promoFromPageText, stickerPromo } from '../src/stores/clicks.ts';

const NOW = '2026-10-26T12:00:00.000Z';
const tile = (text: string, stickers: string[] = []) => ({
  href: '/portia-m_baby-lotion-500ml/p/366942',
  lines: text.split(' | '),
  stickers,
});

describe('clicks stickers', () => {
  it('reads 3for2 and saveNN stickers', () => {
    expect(stickerPromo(['Vitallity-badge.png', '3for2.png'])).toBe('3 for 2');
    expect(stickerPromo(['save30.png'])).toBe('Save 30%');
  });
  it('ignores loyalty and unknown stickers', () => {
    expect(stickerPromo(['Vitallity-badge.png', 'Web-Stickers-02.png', 'bulk.png'])).toBeUndefined();
  });
});

describe('clicks promoFromPageText', () => {
  it('finds the multi-buy sentence on a product page', () => {
    const text = 'Details\nenglish blazer rollon 50ml save per offer 2for 50.Valid until 23 November 2026\nReviews';
    expect(promoFromPageText(text)).toContain('2for 50');
  });
  it('returns undefined when there is no deal text', () => {
    expect(promoFromPageText('Nothing here\nR 34.99')).toBeUndefined();
  });
});

describe('clicks mapTile', () => {
  it('maps a 3-for-2 baby product', () => {
    const p = mapTile(tile('Portia M | Baby Lotion 500ml | R 79.99 | On promo | Add to basket', ['3for2.png']), '3 for 2', NOW, 'baby')!;
    expect(p.id).toBe('366942');
    expect(p.brand).toBe('Portia M');
    expect(p.name).toBe('Portia M Baby Lotion 500ml');
    expect(p.price).toBe(79.99);
    expect(p.promo).toMatchObject({ kind: 'free', qty: 3, payFor: 2 });
    expect(p.effectivePrice).toBeCloseTo(53.33, 2);
    expect(p.category).toBe('baby');
  });

  it('applies a 2for 50 bulk deal from the detail page', () => {
    const p = mapTile(tile('Yardley | English Blazer Anti-Perspirant Roll-on Black 50ml | R 34.99 | On promo'), 'save per offer 2for 50', NOW, 'health')!;
    expect(p.promo).toMatchObject({ kind: 'price', qty: 2, total: 50 });
    expect(p.effectivePrice).toBe(25);
  });

  it('drops the "See more variants" label and skips tiles without a price', () => {
    const p = mapTile(tile('See more variants | Clicks | High Shine Pantihose Black M | R 72.99 | On promo'), 'Save 30%', NOW, 'health')!;
    expect(p.name).toBe('Clicks High Shine Pantihose Black M');
    expect(p.effectivePrice).toBeCloseTo(51.09, 2);
    expect(mapTile(tile('Something | no price here'), undefined, NOW, 'health')).toBeNull();
  });
});
