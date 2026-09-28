import { offlineQueueService } from 'services/offlineQueueService'
import type { SyncQueueItem, SyncResource } from 'services/offlineQueueService'
import { WorkspaceConflictError, workspaceRepository } from 'repositories/workspaceRepository'
import { isRetryDue } from 'utils/retryPolicy'
import { useWorkspaceStore } from 'features/store/workspaceStore'
import type { Note, Shortcut, Todo } from 'features/store/workspaceStore'
import { settingsStore } from 'features/store/stores/settingsStore'
import { pendingNoteDeletionService } from 'services/pendingNoteDeletionService'
import { pendingTodoDeletionService } from 'services/pendingTodoDeletionService'

export interface SettingsPayload {
  theme: string
  greeting_name: string
  search_engine: string
  background_mode: string
  background_color: string
  background_image_url: string
  show_greeting: boolean
  show_quicklinks: boolean
  version?: number
}

export interface FlushResult {
  processed: number
  failed: number
  remaining: number
  offline: boolean
  conflicts: number
}

interface TodoDeletion {
  id: string
  version?: number
}

interface TodosPayload {
  items: Todo[]
  deleted: TodoDeletion[]
}

interface NoteDeletion {
  id: string
  version?: number
}

interface NotesPayload {
  items: Note[]
  deleted: NoteDeletion[]
}

interface ShortcutDeletion {
  id: string
  version?: number
}

interface ShortcutsPayload {
  items: Shortcut[]
  deleted: ShortcutDeletion[]
}

const activeFlushes = new Map<string, Promise<FlushResult>>()
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const confirmedTodoVersions = new Map<string, Map<string, number>>()
const confirmedNoteVersions = new Map<string, Map<string, number>>()
const confirmedSettingsVersions = new Map<string, number>()
const confirmedShortcutVersions = new Map<string, Map<string, number>>()

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine

const toTodosPayload = (payload: unknown): TodosPayload => {
  if (Array.isArray(payload)) {
    return { items: payload as Todo[], deleted: [] }
  }
  const candidate = payload as Partial<TodosPayload> | null
  const legacyDeleted = (candidate as { deletedIds?: string[] } | null)?.deletedIds || []
  const deleted = Array.isArray(candidate?.deleted)
    ? candidate.deleted.map(item => typeof item === 'string' ? { id: item } : item)
    : legacyDeleted.map(id => ({ id }))
  return {
    items: Array.isArray(candidate?.items) ? candidate.items : [],
    deleted,
  }
}

const syncTodos = async (userId: string, payload: TodosPayload) => {
  await workspaceRepository.softDeleteTodos(userId, payload.deleted)
  return workspaceRepository.upsertTodos(userId, payload.items)
}

const toNotesPayload = (payload: unknown): NotesPayload => {
  if (Array.isArray(payload)) return { items: payload as Note[], deleted: [] }
  const candidate = payload as Partial<NotesPayload> & Partial<Note> | null
  if (candidate && typeof candidate.id === 'string' && 'content' in candidate) {
    return { items: [candidate as Note], deleted: [] }
  }
  return {
    items: Array.isArray(candidate?.items) ? candidate.items : [],
    deleted: Array.isArray(candidate?.deleted) ? candidate.deleted : [],
  }
}

const syncNotes = async (userId: string, payload: NotesPayload) => {
  await workspaceRepository.deleteNotes(userId, payload.deleted)
  return workspaceRepository.upsertNotes(userId, payload.items)
}

const toShortcutsPayload = (payload: unknown): ShortcutsPayload => {
  if (Array.isArray(payload)) return { items: payload as Shortcut[], deleted: [] }
  const candidate = payload as Partial<ShortcutsPayload> | null
  return {
    items: Array.isArray(candidate?.items) ? candidate.items : [],
    deleted: Array.isArray(candidate?.deleted) ? candidate.deleted : [],
  }
}

const syncShortcuts = async (userId: string, payload: ShortcutsPayload) => {
  await workspaceRepository.deleteBookmarks(userId, payload.deleted)
  return workspaceRepository.upsertBookmarks(userId, payload.items)
}

const sameTodoContent = (left: Todo, right: Todo) => JSON.stringify({
  text: left.text,
  done: left.done,
  priority: left.priority,
  tag: left.tag,
  subtasks: left.subtasks || [],
  dueDate: left.dueDate || '',
}) === JSON.stringify({
  text: right.text,
  done: right.done,
  priority: right.priority,
  tag: right.tag,
  subtasks: right.subtasks || [],
  dueDate: right.dueDate || '',
})

const sameNoteContent = (left: Note, right: Note) =>
  left.title === right.title && left.content === right.content

const sameShortcutContent = (left: Shortcut, right: Shortcut) =>
  left.name === right.name && left.url === right.url && left.emoji === right.emoji && left.color === right.color

const rememberTodoVersions = (userId: string, todos: Todo[]) => {
  const versions = confirmedTodoVersions.get(userId) || new Map<string, number>()
  todos.forEach(todo => {
    if (Number.isInteger(todo.version)) versions.set(todo.id, todo.version as number)
  })
  confirmedTodoVersions.set(userId, versions)
}

const rememberNoteVersions = (userId: string, notes: Note[]) => {
  const versions = confirmedNoteVersions.get(userId) || new Map<string, number>()
  notes.forEach(note => {
    if (Number.isInteger(note.version)) versions.set(note.id, note.version as number)
  })
  confirmedNoteVersions.set(userId, versions)
}

const rememberSettingsVersion = (userId: string, settings: { version?: number }) => {
  if (Number.isInteger(settings.version)) confirmedSettingsVersions.set(userId, settings.version as number)
}

const rememberShortcutVersions = (userId: string, shortcuts: Shortcut[]) => {
  const versions = confirmedShortcutVersions.get(userId) || new Map<string, number>()
  shortcuts.forEach(shortcut => {
    if (Number.isInteger(shortcut.version)) versions.set(shortcut.id, shortcut.version as number)
  })
  confirmedShortcutVersions.set(userId, versions)
}

const applyRemoteSettings = (remote: Record<string, unknown>) => {
  settingsStore.replaceFromSync({
    theme: remote.theme,
    greetingName: remote.greeting_name,
    searchEngine: remote.search_engine,
    backgroundMode: remote.background_mode,
    backgroundColor: remote.background_color,
    backgroundImageUrl: remote.background_image_url,
    showGreeting: remote.show_greeting,
    showQuicklinks: remote.show_quicklinks,
    version: remote.version,
  })
}

const reconcileTodoSync = (userId: string, payload: TodosPayload, uploaded: Todo[]) => {
  rememberTodoVersions(userId, uploaded)
  const current = useWorkspaceStore.getState().todos
  const uploadedById = new Map(uploaded.map(todo => [todo.id, todo]))
  const queuedById = new Map(payload.items.map(todo => [todo.id, todo]))
  const deletedIds = new Set(payload.deleted.map(item => item.id))
  const next = current
    .filter(todo => !deletedIds.has(todo.id))
    .map(todo => {
      const remote = uploadedById.get(todo.id)
      const queued = queuedById.get(todo.id)
      if (!remote || !queued || !sameTodoContent(todo, queued)) return todo
      if (todo.version === remote.version && todo.updatedAt === remote.updatedAt) return todo
      return { ...todo, version: remote.version, updatedAt: remote.updatedAt }
    })
  if (next.length !== current.length || next.some((todo, index) => todo !== current[index])) {
    useWorkspaceStore.getState().replaceTodosFromSync(next)
  }
}

const reconcileNoteSync = (userId: string, payload: NotesPayload, uploaded: Note[]) => {
  rememberNoteVersions(userId, uploaded)
  const current = useWorkspaceStore.getState().notes
  const uploadedById = new Map(uploaded.map(note => [note.id, note]))
  const queuedById = new Map(payload.items.map(note => [note.id, note]))
  const deletedIds = new Set(payload.deleted.map(item => item.id))
  const next = current
    .filter(note => !deletedIds.has(note.id))
    .map(note => {
      const remote = uploadedById.get(note.id)
      const queued = queuedById.get(note.id)
      if (!remote || !queued || !sameNoteContent(note, queued)) return note
      if (note.version === remote.version && note.updatedAt === remote.updatedAt) return note
      return { ...note, version: remote.version, createdAt: remote.createdAt, updatedAt: remote.updatedAt }
    })
  if (next.length !== current.length || next.some((note, index) => note !== current[index])) {
    useWorkspaceStore.getState().replaceNotesFromSync(next)
  }
}

const reconcileShortcutSync = (userId: string, payload: ShortcutsPayload, uploaded: Shortcut[]) => {
  rememberShortcutVersions(userId, uploaded)
  const current = useWorkspaceStore.getState().shortcuts
  const uploadedById = new Map(uploaded.map(shortcut => [shortcut.id, shortcut]))
  const queuedById = new Map(payload.items.map(shortcut => [shortcut.id, shortcut]))
  const deletedIds = new Set(payload.deleted.map(item => item.id))
  const next = current
    .filter(shortcut => !deletedIds.has(shortcut.id))
    .map(shortcut => {
      const remote = uploadedById.get(shortcut.id)
      const queued = queuedById.get(shortcut.id)
      if (!remote || !queued || !sameShortcutContent(shortcut, queued)) return shortcut
      if (shortcut.version === remote.version && shortcut.updatedAt === remote.updatedAt) return shortcut
      return { ...shortcut, version: remote.version, updatedAt: remote.updatedAt }
    })
  if (next.length !== current.length || next.some((shortcut, index) => shortcut !== current[index])) {
    useWorkspaceStore.getState().replaceShortcutsFromSync(next)
  }
}

const resolveShortcutConflict = async (userId: string, payload: ShortcutsPayload) => {
  const remote = await workspaceRepository.listBookmarks(userId) as Shortcut[]
  rememberShortcutVersions(userId, remote)
  const current = useWorkspaceStore.getState().shortcuts
  const remoteById = new Map(remote.map(shortcut => [shortcut.id, shortcut]))
  const deletedIds = new Set(payload.deleted.map(item => item.id))
  const currentIds = new Set(current.map(shortcut => shortcut.id))
  const rebased = [
    ...current.map(shortcut => {
      const remoteShortcut = remoteById.get(shortcut.id)
      if (!remoteShortcut) return { ...shortcut, version: undefined }
      return { ...shortcut, version: remoteShortcut.version }
    }),
    ...remote.filter(shortcut => !currentIds.has(shortcut.id) && !deletedIds.has(shortcut.id)),
  ]
  const rebasedDeletions = payload.deleted.map(deletion => ({
    ...deletion,
    version: remoteById.get(deletion.id)?.version ?? deletion.version,
  }))

  useWorkspaceStore.getState().replaceShortcutsFromSync(rebased)
  await offlineQueueService.updatePayload<ShortcutsPayload>(userId, 'shortcuts', () => ({
    items: rebased,
    deleted: rebasedDeletions,
  }))
}

const resolveTodoConflict = async (userId: string, conflict: WorkspaceConflictError) => {
  const local = conflict.local as Todo
  const current = useWorkspaceStore.getState().todos
  const currentTodo = current.find(todo => todo.id === local.id)
  if (currentTodo && !sameTodoContent(currentTodo, local)) return

  const conflictCopy = 'text' in local
    ? await workspaceRepository.createTodoConflict(userId, local)
    : null
  const remoteTodos = await workspaceRepository.listTodos(userId)
  const remote = remoteTodos.find((todo: Todo) => todo.id === local.id)
  rememberTodoVersions(userId, remote ? [remote] : [])
  const next = current.filter(todo => todo.id !== local.id)
  if (remote) next.push(remote)
  if (conflictCopy) next.push(conflictCopy)
  useWorkspaceStore.getState().replaceTodosFromSync(next)
}

const resolveNoteConflict = async (userId: string, conflict: WorkspaceConflictError) => {
  const local = conflict.local as Note | NoteDeletion
  if (!('content' in local)) {
    const remoteNotes = await workspaceRepository.listNotes(userId)
    const remote = remoteNotes.find((note: Note) => note.id === local.id)
    if (!remote) {
      pendingNoteDeletionService.clear(userId, [local.id])
      return
    }
    rememberNoteVersions(userId, [remote])
    await offlineQueueService.updatePayload<NotesPayload>(userId, 'note', current => {
      const queued = toNotesPayload(current)
      return {
        items: queued.items.filter(note => note.id !== local.id),
        deleted: queued.deleted.map(deletion => deletion.id === local.id
          ? { ...deletion, version: remote.version }
          : deletion),
      }
    })
    return
  }
  const current = useWorkspaceStore.getState().notes
  const currentNote = current.find(note => note.id === local.id)
  if (currentNote && !sameNoteContent(currentNote, local)) return
  const conflictCopy = await workspaceRepository.createNoteConflict(userId, local)
  const remoteNotes = await workspaceRepository.listNotes(userId)
  const remote = remoteNotes.find((note: Note) => note.id === local.id)
  rememberNoteVersions(userId, remote ? [remote] : [])
  const next = current.filter(note => note.id !== local.id)
  if (remote) next.push(remote)
  if (conflictCopy) next.push(conflictCopy)
  useWorkspaceStore.getState().replaceNotesFromSync(next)
}

const processItem = async (item: SyncQueueItem): Promise<number> => {
  if (item.resource === 'todos') {
    const payload = toTodosPayload(item.payload)
    try {
      const uploaded = await syncTodos(item.userId, payload)
      pendingTodoDeletionService.clear(item.userId, payload.deleted.map(deletion => deletion.id))
      reconcileTodoSync(item.userId, payload, uploaded)
    } catch (error) {
      if (!(error instanceof WorkspaceConflictError)) throw error
      await resolveTodoConflict(item.userId, error)
      return 1
    }
    return 0
  }
  if (item.resource === 'note') {
    const payload = toNotesPayload(item.payload)
    try {
      const uploaded = await syncNotes(item.userId, payload)
      pendingNoteDeletionService.clear(item.userId, payload.deleted.map(deletion => deletion.id))
      reconcileNoteSync(item.userId, payload, uploaded)
    } catch (error) {
      if (!(error instanceof WorkspaceConflictError)) throw error
      await resolveNoteConflict(item.userId, error)
      return 1
    }
    return 0
  }
  if (item.resource === 'shortcuts') {
    const payload = toShortcutsPayload(item.payload)
    try {
      const uploaded = await syncShortcuts(item.userId, payload)
      reconcileShortcutSync(item.userId, payload, uploaded)
    } catch (error) {
      if (!(error instanceof WorkspaceConflictError)) throw error
      await resolveShortcutConflict(item.userId, payload)
      return 1
    }
    return 0
  }
  if (item.resource === 'settings') {
    const settings = item.payload as SettingsPayload
    try {
      const uploaded = await workspaceRepository.updateSettings(item.userId, settings)
      rememberSettingsVersion(item.userId, uploaded)
    } catch (error) {
      if (!(error instanceof WorkspaceConflictError)) throw error
      const remote = error.remote as Record<string, unknown> | null
      if (remote) {
        rememberSettingsVersion(item.userId, remote)
        applyRemoteSettings(remote)
      }
      return 1
    }
  }
  return 0
}

const flushUserQueue = async (userId: string): Promise<FlushResult> => {
  if (!isOnline()) {
    return {
      processed: 0,
      failed: 0,
      remaining: (await offlineQueueService.list(userId)).length,
      offline: true,
      conflicts: 0,
    }
  }

  let processed = 0
  let failed = 0
  let conflicts = 0

  for (let pass = 0; pass < 5; pass += 1) {
    const queue = await offlineQueueService.list(userId)
    const dueItems = queue.filter(item => isRetryDue(item.nextAttemptAt))
    if (dueItems.length === 0) break

    for (const item of dueItems) {
      try {
        conflicts += await processItem(item)
        await offlineQueueService.remove(item.id, item.revision || 0)
        processed += 1
      } catch (error) {
        await offlineQueueService.markFailed(item.id, item.revision || 0, error)
        failed += 1
      }
    }
  }

  return {
    processed,
    failed,
    remaining: (await offlineQueueService.list(userId)).length,
    offline: false,
    conflicts,
  }
}

const scheduleUserRetry = async (userId: string): Promise<void> => {
  const existingTimer = retryTimers.get(userId)
  if (existingTimer) clearTimeout(existingTimer)
  retryTimers.delete(userId)
  if (!isOnline()) return

  const queue = await offlineQueueService.list(userId)
  if (queue.length === 0) return

  const nextAttemptAt = Math.min(...queue.map(item => item.nextAttemptAt))
  const delay = Math.max(0, nextAttemptAt - Date.now())
  const timer = setTimeout(() => {
    retryTimers.delete(userId)
    void workspaceSyncService.flush(userId)
  }, delay)
  retryTimers.set(userId, timer)
}

export const workspaceSyncService = {
  async enqueueTodos(userId: string, todos: Todo[]) {
    const versions = confirmedTodoVersions.get(userId)
    return offlineQueueService.updatePayload<TodosPayload>(userId, 'todos', current => {
      const queued = toTodosPayload(current)
      return {
        items: todos.map(todo => {
          const confirmedVersion = versions?.get(todo.id)
          return confirmedVersion === undefined ? todo : { ...todo, version: confirmedVersion }
        }),
        deleted: queued.deleted,
      }
    })
  },

  async enqueueTodoDeletion(userId: string, deletedTodo: Todo | undefined, remainingTodos: Todo[]) {
    return offlineQueueService.updatePayload<TodosPayload>(userId, 'todos', current => {
      const queued = toTodosPayload(current)
      const deletion = deletedTodo
        ? { id: deletedTodo.id, version: deletedTodo.version }
        : null
      return {
        items: remainingTodos,
        deleted: deletion && !queued.deleted.some(item => item.id === deletion.id)
          ? [...queued.deleted, deletion]
          : queued.deleted,
      }
    })
  },

  async enqueueTodoDeletionMarker(
    userId: string,
    deletion: TodoDeletion,
    remainingTodos: Todo[],
  ) {
    return offlineQueueService.updatePayload<TodosPayload>(userId, 'todos', current => {
      const queued = toTodosPayload(current)
      return {
        items: remainingTodos,
        deleted: queued.deleted.some(item => item.id === deletion.id)
          ? queued.deleted
          : [...queued.deleted, deletion],
      }
    })
  },

  async restoreTodo(userId: string, restoredTodo: Todo, remainingTodos: Todo[]) {
    return offlineQueueService.updatePayload<TodosPayload>(userId, 'todos', current => {
      const queued = toTodosPayload(current)
      return {
        items: [restoredTodo, ...remainingTodos.filter(todo => todo.id !== restoredTodo.id)],
        deleted: queued.deleted.filter(item => item.id !== restoredTodo.id),
      }
    })
  },

  async enqueueNotes(userId: string, notes: Note[]) {
    const versions = confirmedNoteVersions.get(userId)
    return offlineQueueService.updatePayload<NotesPayload>(userId, 'note', current => {
      const queued = toNotesPayload(current)
      return {
        items: notes.map(note => {
          const confirmedVersion = versions?.get(note.id)
          return confirmedVersion === undefined ? note : { ...note, version: confirmedVersion }
        }),
        deleted: queued.deleted,
      }
    })
  },

  async enqueueNote(userId: string, note: Note) {
    const versions = confirmedNoteVersions.get(userId)
    return offlineQueueService.updatePayload<NotesPayload>(userId, 'note', current => {
      const queued = toNotesPayload(current)
      const confirmedVersion = versions?.get(note.id)
      const nextNote = confirmedVersion === undefined ? note : { ...note, version: confirmedVersion }
      return {
        items: [...queued.items.filter(item => item.id !== note.id), nextNote],
        deleted: queued.deleted,
      }
    })
  },

  async enqueueNoteDeletion(userId: string, deletedNote: Note | undefined, remainingNotes: Note[]) {
    return offlineQueueService.updatePayload<NotesPayload>(userId, 'note', current => {
      const queued = toNotesPayload(current)
      const deletion = deletedNote
        ? { id: deletedNote.id, version: deletedNote.version }
        : null
      return {
        items: remainingNotes,
        deleted: deletion && !queued.deleted.some(item => item.id === deletion.id)
          ? [...queued.deleted, deletion]
          : queued.deleted,
      }
    })
  },

  async enqueueNoteDeletionMarker(
    userId: string,
    deletion: NoteDeletion,
    remainingNotes: Note[],
  ) {
    return offlineQueueService.updatePayload<NotesPayload>(userId, 'note', current => {
      const queued = toNotesPayload(current)
      return {
        items: remainingNotes,
        deleted: queued.deleted.some(item => item.id === deletion.id)
          ? queued.deleted
          : [...queued.deleted, deletion],
      }
    })
  },

  async restoreNote(userId: string, restoredNote: Note, remainingNotes: Note[]) {
    confirmedNoteVersions.get(userId)?.delete(restoredNote.id)
    return offlineQueueService.updatePayload<NotesPayload>(userId, 'note', current => {
      const queued = toNotesPayload(current)
      return {
        items: [
          { ...restoredNote, version: undefined },
          ...remainingNotes.filter(note => note.id !== restoredNote.id),
        ],
        deleted: queued.deleted.filter(item => item.id !== restoredNote.id),
      }
    })
  },

  async enqueueShortcuts(userId: string, shortcuts: Shortcut[]) {
    const versions = confirmedShortcutVersions.get(userId)
    return offlineQueueService.updatePayload<ShortcutsPayload>(userId, 'shortcuts', current => {
      const queued = toShortcutsPayload(current)
      return {
        items: shortcuts.map(shortcut => {
          const confirmedVersion = versions?.get(shortcut.id)
          const version = Number.isInteger(shortcut.version) ? shortcut.version : confirmedVersion
          return version === undefined ? shortcut : { ...shortcut, version }
        }),
        deleted: queued.deleted,
      }
    })
  },

  async enqueueShortcutDeletion(userId: string, deletedShortcut: Shortcut | undefined, remainingShortcuts: Shortcut[]) {
    return offlineQueueService.updatePayload<ShortcutsPayload>(userId, 'shortcuts', current => {
      const queued = toShortcutsPayload(current)
      const deletion = deletedShortcut
        ? { id: deletedShortcut.id, version: deletedShortcut.version }
        : null
      return {
        items: remainingShortcuts,
        deleted: deletion && !queued.deleted.some(item => item.id === deletion.id)
          ? [...queued.deleted, deletion]
          : queued.deleted,
      }
    })
  },

  enqueueSettings: (userId: string, settings: SettingsPayload) => {
    const confirmedVersion = confirmedSettingsVersions.get(userId)
    return offlineQueueService.enqueue(userId, 'settings', confirmedVersion === undefined
      ? settings
      : { ...settings, version: confirmedVersion })
  },

  async pendingResources(userId: string): Promise<Set<SyncResource>> {
    return new Set((await offlineQueueService.list(userId)).map(item => item.resource))
  },

  flush(userId: string): Promise<FlushResult> {
    const active = activeFlushes.get(userId)
    if (active) return active

    const flush = flushUserQueue(userId)
      .then(result => {
        void scheduleUserRetry(userId).catch(error => {
          console.error('Failed to schedule workspace retry:', error)
        })
        return result
      })
      .finally(() => activeFlushes.delete(userId))
    activeFlushes.set(userId, flush)
    return flush
  },
}
