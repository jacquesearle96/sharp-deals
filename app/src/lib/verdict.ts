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
 * Compares today's price with what we have seen it cost, to tell real Black Friday deals
 * from fake ones. Returns nothing until there is enough history to say anything honest.
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
  } else if (deal.savePct >= 10 && price >= h.usual * 0.98) {
    out.push({ kind: 'warn', text: `Usual price (${money(h.usual)}), not a real saving` })
  }

  if (deal.wasPrice && h.days >= MIN_DAYS_INFLATED && deal.wasPrice >= h.high * 1.1) {
    out.push({ kind: 'warn', text: `Was ${money(deal.wasPrice)}? Never seen above ${money(h.high)}` })
  }
  return out
}
