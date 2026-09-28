import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from 'constants/storageKeys'
import { recentSearchService } from './recentSearchService'
import { storageService } from './storageService'

const values = new Map<string, string>()
const localStorageMock: Storage = {
  get length() { return values.size },
  clear: () => values.clear(),
  getItem: key => values.get(key) ?? null,
  key: index => Array.from(values.keys())[index] ?? null,
  removeItem: key => { values.delete(key) },
  setItem: (key, value) => { values.set(key, value) },
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock })
})

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

afterEach(() => {
  recentSearchService.clear()
  values.clear()
})

describe('recent search service', () => {
  it('deduplicates searches and keeps the most recent item first', () => {
    recentSearchService.add('first query')
    recentSearchService.add('Second query')
    recentSearchService.add(' FIRST QUERY ')

    expect(recentSearchService.list()).toEqual(['FIRST QUERY', 'Second query'])
  })

  it('limits history and recovers usable entries from malformed arrays', () => {
    for (let index = 0; index < 12; index += 1) recentSearchService.add(`query ${index}`)
    expect(recentSearchService.list()).toHaveLength(8)
    expect(recentSearchService.list()[0]).toBe('query 11')

    storageService.setJSON(STORAGE_KEYS.recentSearches, ['valid', 2, '', 'VALID', 'x'.repeat(501)])
    expect(recentSearchService.list()).toEqual(['valid'])
  })
})
