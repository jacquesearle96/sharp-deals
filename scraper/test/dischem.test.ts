import { describe, expect, it } from 'vitest';
import { mapTile, parseCampaign, parseDates } from '../src/stores/dischem.ts';

const NOW = '2026-10-26T12:00:00.000Z';

const INTRO =
  'Get ready to shop our 2+1 Cheapest Free deals and SAVE BIG on our wide range of wholesome health food picks – exclusive to Better Rewards members from Friday, 30th October, to Sunday, 1st November, 2026, only, while stocks last.';

describe('dischem parseDates', () => {
  it('reads a from/to range with the year only at the end', () => {
    expect(parseDates(INTRO)).toEqual({ starts: '2026-10-30', ends: '2026-11-01' });
  });
  it('returns nothing when there is no year', () => {
    expect(parseDates('from 30th October to 1st November')).toEqual({});
  });
});

describe('dischem parseCampaign', () => {
  it('turns the 2+1 intro into a 3-for-2 campaign with dates', () => {
    const c = parseCampaign(`Header\n${INTRO}\nTerms & Conditions`)!;
    expect(c.promoText.toLowerCase()).toContain('2+1');
    expect(c.starts).toBe('2026-10-30');
    expect(c.ends).toBe('2026-11-01');
  });
  it('ignores landing pages without a multi-buy', () => {
    expect(parseCampaign('Shop festive gifting\nSave on gifts for her')).toBeNull();
  });
});

describe('dischem mapTile', () => {
  const tile = { name: 'Lifestyle Food Honey 500g', href: 'https://www.dischem.co.za/lifestyle-food-honey-500g-478', price: 71.99, oldPrice: 99.99 };

  it('keeps was/now for a plain special price', () => {
    const p = mapTile(tile, undefined, NOW)!;
    expect(p.id).toBe('lifestyle-food-honey-500g-478');
    expect(p.price).toBe(71.99);
    expect(p.wasPrice).toBe(99.99);
    expect(p.promo.kind).toBe('none');
    expect(p.effectivePrice).toBe(71.99);
  });

  it('does not apply a campaign to already-discounted products', () => {
    const p = mapTile(tile, parseCampaign(INTRO)!, NOW)!;
    expect(p.promo.kind).toBe('none');
    expect(p.wasPrice).toBe(99.99);
  });

  it('applies a campaign multi-buy with dates to full-price products', () => {
    const p = mapTile({ ...tile, oldPrice: undefined }, parseCampaign(INTRO)!, NOW)!;
    expect(p.promo).toMatchObject({ kind: 'free', qty: 3, payFor: 2 });
    expect(p.promo.raw).toBe('2+1 Cheapest Free (Better Rewards members)');
    expect(p.effectivePrice).toBeCloseTo(47.99, 2);
    expect(p.promoStarts).toBe('2026-10-30');
    expect(p.promoEnds).toBe('2026-11-01');
  });

  it('skips tiles without a price', () => {
    expect(mapTile({ ...tile, price: 0 }, undefined, NOW)).toBeNull();
  });
});
