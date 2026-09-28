export const getRetryDelay = (
  attempts: number,
  baseDelay = 1000,
  maxDelay = 60_000,
): number => Math.min(baseDelay * 2 ** Math.max(0, attempts - 1), maxDelay)

export const isRetryDue = (nextAttemptAt: number, now = Date.now()): boolean =>
  nextAttemptAt <= now
