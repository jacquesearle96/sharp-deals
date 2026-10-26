import { describe, expect, it } from 'vitest'
import { ago, endsLabel, money, startsLabel } from './format.ts'

describe('format', () => {
  it('formats rand the South African way', () => {
    expect(money(169.99)).toBe('R169.99')
    expect(money(1299)).toBe('R1 299.00')
    expect(money(19)).toBe('R19.00')
  })
  it('labels end and start dates', () => {
    expect(endsLabel('2026-11-08')).toMatch(/^Ends 8 Nov/)
    expect(endsLabel(undefined)).toBeUndefined()
    expect(startsLabel('2026-10-30', new Date('2026-10-26T10:00:00Z'))).toMatch(/^Starts .*30 Oct/)
    expect(startsLabel('2026-10-20', new Date('2026-10-26T10:00:00Z'))).toBeUndefined()
  })
  it('describes how long ago a run finished', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    expect(ago('2026-10-26T11:59:00Z', now)).toBe('just now')
    expect(ago('2026-10-26T11:15:00Z', now)).toBe('45 min ago')
    expect(ago('2026-10-26T06:00:00Z', now)).toBe('6 h ago')
    expect(ago('2026-10-23T12:00:00Z', now)).toBe('3 d ago')
  })
})
