import type { DealProduct } from '../../../shared/types.ts'
import { money } from './format.ts'

export interface Verdict {
  kind: 'good' | 'warn'
  text: string
}

/** Need at least this many days of tracking before we judge a price. */
export const MIN_DAYS = 7
/** A claimed "was" price needs longer tracking before we call it unsupported. */
const MIN_DAYS_INFLATED = 14
/**
 * A special that has held this long is the everyday price. Promotions usually run two to four weeks,
 * so a few weeks of the same "special" price is normal and proves nothing.
 */
export const MIN_DAYS_PERMANENT = 42

/**
 * Compares today's price with what we have seen it cost, to tell real Black Friday deals
 * from fake ones. Returns nothing until there is enough history to say anything honest.
 *
 * Most stores only list their specials, so for most products we only ever see the special price. That
 * alone says nothing about the normal price, so a deal is only called out as fake when we have seen the
 * product at this price with no special on, or the "special" has run unbroken for many weeks.
 */
export function verdicts(deal: DealProduct): Verdict[] {
  const h = deal.hist
  if (!h || h.days < MIN_DAYS) return []
  const out: Verdict[] = []
  const price = deal.effectivePrice

  if (h.high > h.low && price <= h.low) {
    out.push({ kind: 'good', text: `Lowest in ${h.days} days` })
  } else if (price <= h.usual * 0.92) {
    out.push({ kind: 'good', text: `Below its usual ${money(h.usual)}` })
  } else if (deal.savePct >= 10 && h.regular !== undefined && price >= h.regular * 0.98) {
    out.push({ kind: 'warn', text: `${money(h.regular)} with no special on, not a real saving` })
  } else if (deal.savePct >= 10 && (h.steady ?? 0) >= MIN_DAYS_PERMANENT) {
    out.push({ kind: 'warn', text: `Same price for ${Math.floor((h.steady ?? 0) / 7)} weeks, not a real saving` })
  }

  if (deal.wasPrice && h.regularHigh !== undefined && h.days >= MIN_DAYS_INFLATED && deal.wasPrice >= h.regularHigh * 1.1) {
    out.push({ kind: 'warn', text: `Was ${money(deal.wasPrice)}? Never seen above ${money(h.regularHigh)}` })
  }
  return out
}
