import { describe, expect, it } from 'vitest'
import { blackFriday, daysToBlackFriday, RETAILERS, retailersFor } from './retailers.ts'

describe('retailers', () => {
  it('encodes the query in every search URL', () => {
    for (const r of RETAILERS) {
      const url = r.searchUrl('baby monitor & camera')
      expect(url.startsWith('https://')).toBe(true)
      expect(url).toContain('baby%20monitor%20%26%20camera')
    }
  })
  it('offers baby shops for baby and not tech-only shops', () => {
    const baby = retailersFor('baby').map((r) => r.id)
    expect(baby).toContain('babiesrus')
    expect(baby).toContain('babycity')
    expect(baby).not.toContain('evetech')
  })
  it('offers consoles shops for tech', () => {
    const tech = retailersFor('tech').map((r) => r.id)
    expect(tech).toEqual(expect.arrayContaining(['takealot', 'amazon', 'makro', 'game']))
  })
})

describe('black friday', () => {
  it('is the fourth Friday of November', () => {
    expect(blackFriday(2026).toISOString().slice(0, 10)).toBe('2026-11-27')
    expect(blackFriday(2025).toISOString().slice(0, 10)).toBe('2025-11-28')
  })
  it('counts the days remaining', () => {
    expect(daysToBlackFriday(new Date(2026, 9, 26))).toBe(32)
    expect(daysToBlackFriday(new Date(2026, 10, 27))).toBe(0)
  })
})
