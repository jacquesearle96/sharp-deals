import { describe, expect, it } from 'vitest'
import { formatOff, parseOff } from './storeSwitches.ts'

const KNOWN = ['pnp', 'checkers', 'dischem'] as const

describe('store switches', () => {
  it('reads known ids and ignores the rest', () => {
    expect(parseOff('dischem  CHECKERS,nope', KNOWN)).toEqual(['checkers', 'dischem'])
    expect(parseOff(undefined, KNOWN)).toEqual([])
    expect(parseOff('none', KNOWN)).toEqual([])
  })
  it('writes a stable value, with "none" for an empty list', () => {
    expect(formatOff(['dischem', 'pnp'], KNOWN)).toBe('pnp dischem')
    expect(formatOff([], KNOWN)).toBe('none')
    expect(parseOff(formatOff(['checkers'], KNOWN), KNOWN)).toEqual(['checkers'])
  })
})
