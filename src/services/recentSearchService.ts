import { STORAGE_KEYS } from 'constants/storageKeys'
import { storageService } from './storageService'

const MAX_RECENT_SEARCHES = 8
const MAX_SEARCH_LENGTH = 500

export const normalizeRecentSearches = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null

  const seen = new Set<string>()
  const searches: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const search = item.trim()
    const key = search.toLocaleLowerCase()
    if (!search || search.length > MAX_SEARCH_LENGTH || seen.has(key)) continue
    seen.add(key)
    searches.push(search)
    if (searches.length === MAX_RECENT_SEARCHES) break
  }
  return searches
}

let memoryFallback: string[] = []

const read = () => {
  memoryFallback = storageService.getValidatedJSON(
  STORAGE_KEYS.recentSearches,
  memoryFallback,
  normalizeRecentSearches,
  )
  return memoryFallback
}

const write = (searches: string[]) => {
  memoryFallback = searches
  return storageService.setJSON(STORAGE_KEYS.recentSearches, searches)
}

export const recentSearchService = {
  list(): string[] {
    return read()
  },

  add(value: string): string[] {
    const search = value.trim()
    if (!search || search.length > MAX_SEARCH_LENGTH) return read()
    const key = search.toLocaleLowerCase()
    const next = [search, ...read().filter(item => item.toLocaleLowerCase() !== key)]
      .slice(0, MAX_RECENT_SEARCHES)
    return write(next)
  },

  clear(): string[] {
    return write([])
  },
}
