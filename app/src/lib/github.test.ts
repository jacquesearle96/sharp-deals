import { describe, expect, it } from 'vitest'
import { describeRun, isActive, repoFrom, type Run } from './ps5Refresh.ts'

describe('repoFrom', () => {
  it('reads the repository from a GitHub Pages address', () => {
    expect(repoFrom('someone.github.io', '/sharp-deals/')).toEqual({ owner: 'someone', name: 'sharp-deals' })
  })
  it('falls back to "owner/repo" elsewhere, and gives up without one', () => {
    expect(repoFrom('localhost', '/', 'someone/sharp-deals')).toEqual({ owner: 'someone', name: 'sharp-deals' })
    expect(repoFrom('localhost', '/')).toBeUndefined()
  })
})

describe('run status', () => {
  const run = (status: string, conclusion: string | null = null): Run => ({ id: 1, status, conclusion, created_at: '', html_url: '' })
  it('treats anything but completed as still going', () => {
    expect(isActive(run('queued'))).toBe(true)
    expect(isActive(run('in_progress'))).toBe(true)
    expect(isActive(run('completed', 'success'))).toBe(false)
    expect(isActive(undefined)).toBe(false)
  })
  it('explains a queued run behind the main scrape', () => {
    expect(describeRun(run('queued'))).toMatch(/main deals scrape/)
  })
})
