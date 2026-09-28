import { createStore, del, get, set } from 'idb-keyval'
import type { Note } from 'features/store/workspaceStore'
import { STORAGE_KEYS } from 'constants/storageKeys'
import { storageService } from './storageService'

interface NoteBodyRecord {
  content: string
  updatedAt?: string
}

const store = createStore('clean-tab-notes', 'bodies')
const keyFor = (id: string) => `note-body:${id}`
let writeChain: Promise<void> = Promise.resolve()

const canUseIndexedDb = () => typeof indexedDB !== 'undefined'

const queueWrite = (operation: () => Promise<void>) => {
  const next = writeChain.then(operation)
  writeChain = next.catch(() => undefined)
  return next
}

export const noteBodyStorage = {
  isAvailable: canUseIndexedDb,

  isMigrated(): boolean {
    return storageService.getJSON<boolean>(STORAGE_KEYS.noteBodyMigration, false) === true
  },

  markMigrated(): void {
    storageService.setJSON(STORAGE_KEYS.noteBodyMigration, true)
  },

  async readMany(notes: Note[]): Promise<Map<string, NoteBodyRecord>> {
    if (!canUseIndexedDb()) return new Map()
    const entries = await Promise.all(notes.map(async note => {
      const body = await get<NoteBodyRecord>(keyFor(note.id), store)
      return body ? [note.id, body] as const : null
    }))
    return new Map(entries.filter((entry): entry is readonly [string, NoteBodyRecord] => entry !== null))
  },

  writeMany(notes: Note[]): Promise<void> {
    if (!canUseIndexedDb()) return Promise.resolve()
    return queueWrite(async () => {
      await Promise.all(notes.map(note => set(
        keyFor(note.id),
        { content: note.content || '', updatedAt: note.updatedAt },
        store,
      )))
    })
  },

  removeMany(ids: string[]): Promise<void> {
    if (!canUseIndexedDb() || ids.length === 0) return Promise.resolve()
    return queueWrite(async () => {
      await Promise.all(ids.map(id => del(keyFor(id), store)))
    })
  },
}
