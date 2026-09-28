export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'queued' | 'error'

// 状态文案同时供页头状态标签与同步面板使用，集中在此避免两处不一致。
export const syncLabels: Record<SyncState, string> = {
  local: '仅本地保存',
  syncing: '本地已存 · 同步中',
  synced: '本地与云端已同步',
  offline: '本地已存 · 当前离线',
  queued: '本地已存 · 等待同步',
  error: '本地已存 · 同步异常',
}
