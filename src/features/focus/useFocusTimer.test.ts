import { describe, expect, it } from 'vitest'
import { formatFocusTime, getRemainingSeconds } from './useFocusTimer'

describe('focus timer helpers', () => {
  it('formats time and derives remaining seconds from an absolute end time', () => {
    expect(formatFocusTime(1500)).toBe('25:00')
    expect(formatFocusTime(61)).toBe('01:01')
    expect(getRemainingSeconds({ mode: 'focus', endsAt: 11_500, pausedSeconds: 1500 }, 10_000)).toBe(2)
  })

  it('never returns a negative remaining duration', () => {
    expect(getRemainingSeconds({ mode: 'short-break', endsAt: 9_000, pausedSeconds: 300 }, 10_000)).toBe(0)
  })
})
