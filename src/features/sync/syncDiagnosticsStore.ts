import { create } from 'zustand'
import { STORAGE_KEYS } from 'constants/storageKeys'
import { offlineQueueService } from 'services/offlineQueueService'
import type { SyncResource } from 'services/offlineQueueService'
import { storageService } from 'services/storageService'

export interface SyncDiagnostics {
  pendingCount: number
  pendingResources: SyncResource[]
  attempts: number
  lastSyncedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
}

const EMPTY: SyncDiagnostics = {
  pendingCount: 0,
  pendingResources: [],
  attempts: 0,
  lastSyncedAt: null,
  lastError: null,
  lastErrorAt: null,
}

const isIsoString = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

const readPersisted = (): Pick<SyncDiagnostics, 'lastSyncedAt' | 'lastError' | 'lastErrorAt'> => {
  const fallback = { lastSyncedAt: null, lastError: null, lastErrorAt: null }
  return storageService.getValidatedJSON(STORAGE_KEYS.syncDiagnostics, fallback, value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const candidate = value as Record<string, unknown>
    return {
      lastSyncedAt: isIsoString(candidate.lastSyncedAt) ? candidate.lastSyncedAt : null,
      lastError: typeof candidate.lastError === 'string' && candidate.lastError ? candidate.lastError : null,
      lastErrorAt: isIsoString(candidate.lastErrorAt) ? candidate.lastErrorAt : null,
    }
  })
}

const persist = (state: SyncDiagnostics) => {
  storageService.setJSON(STORAGE_KEYS.syncDiagnostics, {
    lastSyncedAt: state.lastSyncedAt,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
  })
}

interface SyncDiagnosticsStore extends SyncDiagnostics {
  refresh: (userId: string) => Promise<void>
  recordSuccess: () => void
  recordFailure: (message: string) => void
  reset: () => void
}

// 同步面板的数据来源。队列相关的字段每次读取时从离线队列实时计算，
// 只有「上次成功同步」与「最近错误」需要跨会话保留。
export const useSyncDiagnostics = create<SyncDiagnosticsStore>()((set, get) => ({
  ...EMPTY,
  ...readPersisted(),

  async refresh(userId) {
    try {
      const queue = await offlineQueueService.list(userId)
      const failed = queue
        .filter(item => item.lastError)
        .sort((left, right) => right.nextAttemptAt - left.nextAttemptAt)[0]

      set({
        pendingCount: queue.length,
        pendingResources: [...new Set(queue.map(item => item.resource))],
        attempts: queue.reduce((max, item) => Math.max(max, item.attempts), 0),
        ...(failed?.lastError
          ? { lastError: failed.lastError, lastErrorAt: new Date().toISOString() }
          : {}),
      })
    } catch (error) {
      console.error('读取同步队列失败：', error)
    }
  },

  recordSuccess() {
    const next = { ...get(), lastSyncedAt: new Date().toISOString(), lastError: null, lastErrorAt: null }
    persist(next)
    set({ lastSyncedAt: next.lastSyncedAt, lastError: null, lastErrorAt: null })
  },

  recordFailure(message) {
    const next = { ...get(), lastError: message, lastErrorAt: new Date().toISOString() }
    persist(next)
    set({ lastError: next.lastError, lastErrorAt: next.lastErrorAt })
  },

  reset() {
    persist(EMPTY)
    set(EMPTY)
  },
}))
