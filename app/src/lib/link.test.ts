import { describe, expect, it } from 'vitest'
import { safeLink } from './link.ts'

describe('safeLink', () => {
  it('keeps web links', () => {
    expect(safeLink('https://www.pnp.co.za/p/123')).toBe('https://www.pnp.co.za/p/123')
  })
  it('drops script links, relative paths and missing links', () => {
    expect(safeLink('javascript:alert(1)')).toBeUndefined()
    expect(safeLink('/medias/x')).toBeUndefined()
    expect(safeLink(undefined)).toBeUndefined()
  })
})
