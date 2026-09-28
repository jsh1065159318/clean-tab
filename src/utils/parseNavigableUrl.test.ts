import { describe, expect, it } from 'vitest'
import { parseNavigableUrl } from './parseNavigableUrl'

describe('parseNavigableUrl', () => {
  it.each([
    ['https://example.com/path?q=1', 'https://example.com/path?q=1'],
    ['http://example.com', 'http://example.com/'],
    ['example.com/docs', 'https://example.com/docs'],
    ['localhost:4173/path', 'http://localhost:4173/path'],
    ['127.0.0.1:8080', 'http://127.0.0.1:8080/'],
    ['例子.测试', 'https://xn--fsqu00a.xn--0zwm56d/'],
  ])('normalizes %s', (input, expected) => {
    expect(parseNavigableUrl(input)).toBe(expected)
  })

  it.each([
    'javascript://alert(1)',
    'data:text/html,test',
    'file:///tmp/test',
    'mailto:test@example.com',
    'custom://open',
    'not a url',
    '',
  ])('rejects %s', input => {
    expect(parseNavigableUrl(input)).toBeNull()
  })
})
