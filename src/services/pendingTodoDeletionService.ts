import { STORAGE_KEYS } from 'constants/storageKeys'
import { storageService } from './storageService'

export interface PendingTodoDeletion {
  userId: string
  id: string
  version?: number
  markedAt: number
}

const normalize = (value: unknown): PendingTodoDeletion[] | null => {
  if (!Array.isArray(value)) return null
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<PendingTodoDeletion>
    if (typeof candidate.userId !== 'string' || typeof candidate.id !== 'string') return []
    return [{
      userId: candidate.userId,
      id: candidate.id,
      version: Number.isInteger(candidate.version) ? candidate.version : undefined,
      markedAt: typeof candidate.markedAt === 'number' ? candidate.markedAt : Date.now(),
    }]
  })
}

let memoryFallback: PendingTodoDeletion[] = []

const read = () => storageService.getValidatedJSON<PendingTodoDeletion[]>(
  STORAGE_KEYS.pendingTodoDeletions,
  memoryFallback,
  normalize,
)

const readWithFallback = () => {
  memoryFallback = read()
  return memoryFallback
}

const write = (items: PendingTodoDeletion[]) => {
  memoryFallback = items
  storageService.setJSON(STORAGE_KEYS.pendingTodoDeletions, items)
}

export const pendingTodoDeletionService = {
  list(userId: string): PendingTodoDeletion[] {
    return readWithFallback().filter(item => item.userId === userId)
  },

  mark(userId: string, id: string, version?: number): void {
    const items = readWithFallback().filter(item => !(item.userId === userId && item.id === id))
    write([...items, { userId, id, version, markedAt: Date.now() }])
  },

  clear(userId: string, ids: string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    write(readWithFallback().filter(item => item.userId !== userId || !idSet.has(item.id)))
  },
}
