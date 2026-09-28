import { STORAGE_KEYS } from 'constants/storageKeys'
import { storageService } from './storageService'

export interface PendingNoteDeletion {
  userId: string
  id: string
  version?: number
  markedAt: number
}

const normalize = (value: unknown): PendingNoteDeletion[] | null => {
  if (!Array.isArray(value)) return null
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<PendingNoteDeletion>
    if (typeof candidate.userId !== 'string' || typeof candidate.id !== 'string') return []
    return [{
      userId: candidate.userId,
      id: candidate.id,
      version: Number.isInteger(candidate.version) ? candidate.version : undefined,
      markedAt: typeof candidate.markedAt === 'number' ? candidate.markedAt : Date.now(),
    }]
  })
}

let memoryFallback: PendingNoteDeletion[] = []

const read = () => {
  memoryFallback = storageService.getValidatedJSON(
    STORAGE_KEYS.pendingNoteDeletions,
    memoryFallback,
    normalize,
  )
  return memoryFallback
}

const write = (items: PendingNoteDeletion[]) => {
  memoryFallback = items
  storageService.setJSON(STORAGE_KEYS.pendingNoteDeletions, items)
}

export const pendingNoteDeletionService = {
  list(userId: string): PendingNoteDeletion[] {
    return read().filter(item => item.userId === userId)
  },

  mark(userId: string, id: string, version?: number): void {
    const items = read().filter(item => !(item.userId === userId && item.id === id))
    write([...items, { userId, id, version, markedAt: Date.now() }])
  },

  clear(userId: string, ids: string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    write(read().filter(item => item.userId !== userId || !idSet.has(item.id)))
  },
}
