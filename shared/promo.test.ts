import { describe, expect, it } from 'vitest';
import { effectivePrice, isMultiBuy, parsePromo, promoLabel } from './promo.ts';

describe('parsePromo', () => {
  it('parses "3 for 2"', () => {
    expect(parsePromo('3 for 2')).toMatchObject({ kind: 'free', qty: 3, payFor: 2 });
  });
  it('parses "3 for the price of 2"', () => {
    expect(parsePromo('3 for the price of 2')).toMatchObject({ kind: 'free', qty: 3, payFor: 2 });
  });
  it('parses "Buy 1 Get 1 Free"', () => {
    expect(parsePromo('Buy 1 Get 1 Free')).toMatchObject({ kind: 'free', qty: 2, payFor: 1 });
  });
  it('parses "2 for R50"', () => {
    expect(parsePromo('2 for R50')).toMatchObject({ kind: 'price', qty: 2, total: 50 });
  });
  it('parses "Buy 2 for R49.98"', () => {
    expect(parsePromo('Buy 2 for R49.98')).toMatchObject({ kind: 'price', qty: 2, total: 49.98 });
  });
  it('parses "Buy 2 Save R10"', () => {
    expect(parsePromo('Buy 2 Save R10')).toMatchObject({ kind: 'save', qty: 2, save: 10 });
  });
  it('parses "Buy 3 or more, save 20%"', () => {
    expect(parsePromo('Buy 3 or more, save 20%')).toMatchObject({ kind: 'percent', qty: 3, percent: 20 });
  });
  it('treats a plain saving as a single discount', () => {
    expect(parsePromo('Save R15')).toMatchObject({ kind: 'discount' });
  });
  it('treats "Buy 1 For R99.99" and a bare price as single-item specials', () => {
    const a = parsePromo('Collectaboks: Buy 1 For R99.99');
    expect(a).toMatchObject({ kind: 'price', qty: 1, total: 99.99 });
    expect(isMultiBuy(a)).toBe(false);
    expect(parsePromo('R29.99')).toMatchObject({ kind: 'price', qty: 1, total: 29.99 });
  });
  it('parses "3 For R265.00" with trailing space', () => {
    expect(parsePromo('3 For R265.00 ')).toMatchObject({ kind: 'price', qty: 3, total: 265 });
  });
  it('returns none for empty text', () => {
    expect(parsePromo('')).toMatchObject({ kind: 'none' });
    expect(parsePromo(undefined)).toMatchObject({ kind: 'none' });
  });
});

describe('effectivePrice', () => {
  it('3 for 2 at R30 is R20 each', () => {
    expect(effectivePrice(30, parsePromo('3 for 2'))).toBeCloseTo(20);
  });
  it('2 for R50 is R25 each', () => {
    expect(effectivePrice(30, parsePromo('2 for R50'))).toBeCloseTo(25);
  });
  it('buy 2 save R10 at R30 is R25 each', () => {
    expect(effectivePrice(30, parsePromo('Buy 2 Save R10'))).toBeCloseTo(25);
  });
  it('20% off is 80% of price', () => {
    expect(effectivePrice(50, parsePromo('Buy 3 or more, save 20%'))).toBeCloseTo(40);
  });
  it('no promo returns shelf price', () => {
    expect(effectivePrice(12.5, parsePromo(''))).toBe(12.5);
  });
});

describe('helpers', () => {
  it('flags multi-buys only', () => {
    expect(isMultiBuy(parsePromo('3 for 2'))).toBe(true);
    expect(isMultiBuy(parsePromo('Save R15'))).toBe(false);
  });
  it('labels deals', () => {
    expect(promoLabel(parsePromo('3 for 2'))).toBe('3 for 2');
    expect(promoLabel(parsePromo('2 for R50'))).toBe('2 for R50');
  });
});
