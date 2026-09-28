import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

const now = Date.parse('2026-09-28T12:00:00.000Z')
const ago = (ms: number) => new Date(now - ms).toISOString()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('对空值与非法时间返回 null，避免渲染出 Invalid Date', () => {
    expect(formatRelativeTime(null, now)).toBeNull()
    expect(formatRelativeTime(undefined, now)).toBeNull()
    expect(formatRelativeTime('', now)).toBeNull()
    expect(formatRelativeTime('not-a-date', now)).toBeNull()
  })

  it('一分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('刚刚')
    expect(formatRelativeTime(ago(59_000), now)).toBe('刚刚')
  })

  it('未来时间归为「刚刚」，不产生负数', () => {
    expect(formatRelativeTime(new Date(now + MINUTE).toISOString(), now)).toBe('刚刚')
  })

  it('按量级显示分钟与小时', () => {
    expect(formatRelativeTime(ago(MINUTE), now)).toBe('1 分钟前')
    expect(formatRelativeTime(ago(59 * MINUTE), now)).toBe('59 分钟前')
    expect(formatRelativeTime(ago(HOUR), now)).toBe('1 小时前')
    expect(formatRelativeTime(ago(23 * HOUR), now)).toBe('23 小时前')
  })

  it('按天显示，超过 30 天回退到具体日期', () => {
    expect(formatRelativeTime(ago(DAY), now)).toBe('1 天前')
    expect(formatRelativeTime(ago(29 * DAY), now)).toBe('29 天前')
    expect(formatRelativeTime(ago(60 * DAY), now)).toMatch(/2026/)
  })
})
