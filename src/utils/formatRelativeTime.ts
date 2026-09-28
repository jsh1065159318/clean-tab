const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// 面向同步状态展示的相对时间：只关心量级，不追求精确。
// 解析失败时返回 null，由调用方决定如何降级，避免把 Invalid Date 渲染出去。
export const formatRelativeTime = (value: string | null | undefined, now = Date.now()): string | null => {
  if (!value) return null

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null

  const elapsed = now - timestamp
  if (elapsed < 0) return '刚刚'
  if (elapsed < MINUTE) return '刚刚'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分钟前`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小时前`
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)} 天前`

  return new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}
