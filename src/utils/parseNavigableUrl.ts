const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const EXPLICIT_SCHEME = /^[a-z][a-z\d+.-]*:/i
const LOCAL_HOST = /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\])(?::\d+)?(?:[/?#]|$)/i
const HOSTNAME = /^(?:[^\s./]+\.)+[^\s./]{2,}(?::\d+)?(?:[/?#]|$)/u

const parseHttpUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || !url.hostname) return null
    return url.href
  } catch {
    return null
  }
}

export const parseNavigableUrl = (value: string): string | null => {
  const candidate = value.trim()
  if (!candidate || /\s/.test(candidate)) return null

  if (LOCAL_HOST.test(candidate)) return parseHttpUrl(`http://${candidate}`)
  if (EXPLICIT_SCHEME.test(candidate)) return parseHttpUrl(candidate)
  if (candidate.startsWith('//')) return parseHttpUrl(`https:${candidate}`)
  if (HOSTNAME.test(candidate)) return parseHttpUrl(`https://${candidate}`)
  return null
}
