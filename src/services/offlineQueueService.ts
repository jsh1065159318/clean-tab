import { createStore, get, set } from 'idb-keyval'
import { createId } from 'utils/createId'
import { getRetryDelay } from 'utils/retryPolicy'

export type SyncResource = 'todos' | 'note' | 'settings' | 'shortcuts'

export interface SyncQueueItem<T = unknown> {
  id: string
  userId: string
  resource: SyncResource
  payload: T
  createdAt: number
  revision?: number
  attempts: number
  nextAttemptAt: number
  lastError?: string
}

const QUEUE_KEY = 'workspace-operations-v1'
const queueStore = createStore('clean-tab-sync', 'operations')
let memoryQueue: SyncQueueItem[] = []
let mutationChain: Promise<void> = Promise.resolve()

const canUseIndexedDb = () => typeof indexedDB !== 'undefined'

const readQueue = async (): Promise<SyncQueueItem[]> => {
  if (!canUseIndexedDb()) return memoryQueue
  return (await get<SyncQueueItem[]>(QUEUE_KEY, queueStore)) || []
}

const writeQueue = async (queue: SyncQueueItem[]): Promise<void> => {
  if (!canUseIndexedDb()) {
    memoryQueue = queue
    return
  }
  await set(QUEUE_KEY, queue, queueStore)
}

const mutateQueue = <T>(
  mutation: (queue: SyncQueueItem[]) => { queue: SyncQueueItem[]; result: T },
): Promise<T> => {
  const operation = mutationChain.then(async () => {
    const { queue, result } = mutation(await readQueue())
    await writeQueue(queue)
    return result
  })
  mutationChain = operation.then(() => undefined, () => undefined)
  return operation
}

const upsertQueueItem = <T>(
  userId: string,
  resource: SyncResource,
  getPayload: (current: T | undefined) => T,
): Promise<SyncQueueItem<T>> => mutateQueue(queue => {
  const existing = queue.find(item => item.userId === userId && item.resource === resource)
  const next: SyncQueueItem<T> = {
    id: existing?.id || createId(),
    userId,
    resource,
    payload: getPayload(existing?.payload as T | undefined),
    createdAt: Date.now(),
    revision: (existing?.revision || 0) + 1,
    attempts: 0,
    nextAttemptAt: 0,
  }
  return {
    queue: [
      ...queue.filter(item => item.userId !== userId || item.resource !== resource),
      next,
    ],
    result: next,
  }
})

export const offlineQueueService = {
  async list(userId?: string): Promise<SyncQueueItem[]> {
    await mutationChain
    const queue = await readQueue()
    return userId ? queue.filter(item => item.userId === userId) : queue
  },

  async enqueue<T>(
    userId: string,
    resource: SyncResource,
    payload: T,
  ): Promise<SyncQueueItem<T>> {
    return upsertQueueItem(userId, resource, () => payload)
  },

  async updatePayload<T>(
    userId: string,
    resource: SyncResource,
    getPayload: (current: T | undefined) => T,
  ): Promise<SyncQueueItem<T>> {
    return upsertQueueItem(userId, resource, getPayload)
  },

  async remove(id: string, revision = 0): Promise<void> {
    await mutateQueue(queue => ({
      queue: queue.filter(item => item.id !== id || (item.revision || 0) !== revision),
      result: undefined,
    }))
  },

  async markFailed(id: string, revision: number, error: unknown): Promise<void> {
    await mutateQueue(queue => ({
      queue: queue.map(item => {
        if (item.id !== id || (item.revision || 0) !== revision) return item
        const attempts = item.attempts + 1
        return {
          ...item,
          attempts,
          nextAttemptAt: Date.now() + getRetryDelay(attempts),
          lastError: error instanceof Error ? error.message : String(error),
        }
      }),
      result: undefined,
    }))
  },

  async clearUser(userId: string): Promise<void> {
    await mutateQueue(queue => ({
      queue: queue.filter(item => item.userId !== userId),
      result: undefined,
    }))
  },
}
