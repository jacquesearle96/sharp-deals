import type { Promo } from './types.ts';

const NUM = String.raw`(\d+(?:[.,]\d{1,2})?)`;
const RAND = String.raw`r\s?${NUM}`;

const toNumber = (s: string) => parseFloat(s.replace(',', '.'));

/** Turns a store's promo text (e.g. "3 for 2", "Buy 2 Save R10") into a structured promo. */
export function parsePromo(text: string | undefined | null): Promo {
  const raw = (text ?? '').trim();
  if (!raw) return { kind: 'none', raw };
  const t = raw.toLowerCase().replace(/\s+/g, ' ');

  // "3 for 2" / "3 for the price of 2"
  let m = t.match(/\b(\d+) for (?:the price of )?(\d+)(?![\d.])/);
  if (m) {
    const qty = +m[1];
    const payFor = +m[2];
    if (payFor < qty) return { kind: 'free', raw, qty, payFor };
  }

  // "buy 2 get 1 free" / "buy 1 get 1 free"
  m = t.match(/\bbuy (\d+),? get (\d+) free\b/);
  if (m) return { kind: 'free', raw, qty: +m[1] + +m[2], payFor: +m[1] };

  // "2 for R50" / "buy 2 for R50" / "2for 50"
  m = t.match(new RegExp(String.raw`\b(\d+)\s?for\s?${RAND.replace('r\\s?', 'r?\\s?')}`));
  if (m) return { kind: 'price', raw, qty: +m[1], total: toNumber(m[2]) };

  // "buy 2 save 20%" / "buy 2 get 20% off"
  m = t.match(/\bbuy (\d+)(?: or more)?,? (?:and )?(?:save|get) (\d+(?:\.\d+)?)%/);
  if (m) return { kind: 'percent', raw, qty: +m[1], percent: +m[2] };

  // "buy 2 save R10" / "buy 3 or more, save R30"
  m = t.match(new RegExp(String.raw`\bbuy (\d+)(?: or more)?,? (?:and )?save ${RAND}\b`));
  if (m) return { kind: 'save', raw, qty: +m[1], save: toNumber(m[2]) };

  // single-item percentage: "Save 30%" / "30% off"
  m = t.match(/\bsave (\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)% off\b/);
  if (m) return { kind: 'percent', raw, qty: 1, percent: +(m[1] ?? m[2]) };

  // bare promo price: "R29.99"
  m = t.match(new RegExp(String.raw`^${RAND}$`));
  if (m) return { kind: 'price', raw, qty: 1, total: toNumber(m[1]) };

  // single-item discount: "save R10", "20% off", "was R59"
  if (/\bsave\b|% off|\bwas\b|\bnow\b|special/.test(t)) return { kind: 'discount', raw };

  return { kind: 'none', raw };
}

/** Best per-item price in rand when the promo is taken up. */
export function effectivePrice(price: number, promo: Promo): number {
  switch (promo.kind) {
    case 'free':
      return (price * promo.payFor) / promo.qty;
    case 'price':
      return promo.total / promo.qty;
    case 'save':
      return price - promo.save / promo.qty;
    case 'percent':
      return price * (1 - promo.percent / 100);
    default:
      return price;
  }
}

export const isMultiBuy = (promo: Promo) =>
  (promo.kind === 'free' || promo.kind === 'price' || promo.kind === 'save' || promo.kind === 'percent') &&
  promo.qty > 1;

/** Short label for a deal badge, e.g. "3 for 2" or "2 for R50". */
export function promoLabel(promo: Promo): string {
  switch (promo.kind) {
    case 'free':
      return `${promo.qty} for ${promo.payFor}`;
    case 'price':
      return promo.qty > 1 ? `${promo.qty} for R${promo.total}` : `Special R${promo.total}`;
    case 'save':
      return `Buy ${promo.qty}, save R${promo.save}`;
    case 'percent':
      return `Buy ${promo.qty}, ${promo.percent}% off`;
    case 'discount':
      return 'Special';
    default:
      return '';
  }
}
