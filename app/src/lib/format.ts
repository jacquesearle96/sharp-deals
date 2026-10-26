/** South African shop style: R1 299.99 (decimal point, space between thousands). */
export function money(n: number): string {
  const [whole, cents] = n.toFixed(2).split('.')
  return `R${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${cents}`
}

const short = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' })
const withDay = new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

/** Promo end date as "Ends 8 Nov"; undefined when unknown. */
export function endsLabel(promoEnds: string | undefined): string | undefined {
  if (!promoEnds) return undefined
  const d = new Date(promoEnds)
  return Number.isNaN(d.getTime()) ? undefined : `Ends ${short.format(d).replace(/^0/, '')}`
}

/** "Starts Fri 30 Oct" for a promo that has not begun yet. */
export function startsLabel(promoStarts: string | undefined, now = new Date()): string | undefined {
  if (!promoStarts) return undefined
  const d = new Date(promoStarts)
  if (Number.isNaN(d.getTime()) || d.getTime() <= now.getTime()) return undefined
  return `Starts ${withDay.format(d).replace(/,/g, '')}`
}

export function ago(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000))
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 36) return `${hrs} h ago`
  return `${Math.round(hrs / 24)} d ago`
}
