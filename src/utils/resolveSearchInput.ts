import { parseNavigableUrl } from './parseNavigableUrl'

export type SearchEngineId = 'google' | 'bing' | 'duckduckgo'

// 首页的引擎切换器与设置页共用同一份列表，避免两处各写一份而逐渐不一致。
export const searchEngineOptions: Array<{ id: SearchEngineId; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
]

export const isSearchEngineId = (value: unknown): value is SearchEngineId =>
  typeof value === 'string' && searchEngineOptions.some(option => option.id === value)

const searchEngines: Record<SearchEngineId, string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
}

const searchPrefixes: Record<string, SearchEngineId> = {
  g: 'google',
  b: 'bing',
  d: 'duckduckgo',
}

export interface ResolvedSearchInput {
  historyValue: string | null
  target: string
}

export const resolveSearchInput = (
  value: string,
  defaultEngine: string = 'google',
): ResolvedSearchInput | null => {
  const input = value.trim()
  if (!input) return null

  const directUrl = parseNavigableUrl(input)
  if (directUrl) return { historyValue: null, target: directUrl }

  const prefixMatch = input.match(/^([gbd])(?::|\s+)\s*(.+)$/i)
  const engine = prefixMatch
    ? searchPrefixes[prefixMatch[1].toLocaleLowerCase()]
    : (defaultEngine in searchEngines ? defaultEngine as SearchEngineId : 'google')
  const query = prefixMatch?.[2] || input

  return {
    historyValue: input,
    target: `${searchEngines[engine]}${encodeURIComponent(query)}`,
  }
}
