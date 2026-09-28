import { describe, expect, it } from 'vitest'
import { resolveSearchInput } from './resolveSearchInput'

describe('resolveSearchInput', () => {
  it.each([
    ['g release notes', 'bing', 'https://www.google.com/search?q=release%20notes'],
    ['B: browser extensions', 'google', 'https://www.bing.com/search?q=browser%20extensions'],
    ['d privacy search', 'google', 'https://duckduckgo.com/?q=privacy%20search'],
    ['regular query', 'bing', 'https://www.bing.com/search?q=regular%20query'],
  ])('resolves %s with search prefixes', (input, defaultEngine, target) => {
    expect(resolveSearchInput(input, defaultEngine)).toEqual({ historyValue: input, target })
  })

  it('keeps navigable urls out of search history', () => {
    expect(resolveSearchInput('example.com/docs', 'bing')).toEqual({
      historyValue: null,
      target: 'https://example.com/docs',
    })
  })

  it('falls back to Google for unknown engines and rejects empty input', () => {
    expect(resolveSearchInput('test', 'unknown')?.target).toBe('https://www.google.com/search?q=test')
    expect(resolveSearchInput('  ')).toBeNull()
  })
})
