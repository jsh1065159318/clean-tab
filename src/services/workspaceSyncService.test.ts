import { afterEach, describe, expect, it } from 'vitest'
import type { Note, Todo } from 'features/store/workspaceStore'
import { offlineQueueService } from './offlineQueueService'
import { workspaceSyncService } from './workspaceSyncService'

const userId = 'sync-delete-test-user'
const todos: Todo[] = [
  { id: 'delete-me', text: 'Delete', done: false, priority: 'medium', tag: '', subtasks: [], version: 7 },
  { id: 'keep-me', text: 'Keep', done: false, priority: 'low', tag: '', subtasks: [] },
]
const notes: Note[] = [
  { id: 'delete-note', title: 'Delete', content: 'A', version: 5 },
  { id: 'keep-note', title: 'Keep', content: 'B' },
]

afterEach(async () => {
  await offlineQueueService.clearUser(userId)
})

describe('workspace todo deletion queue', () => {
  it('keeps the remaining snapshot and a versioned deletion tombstone', async () => {
    await workspaceSyncService.enqueueTodos(userId, todos)
    await workspaceSyncService.enqueueTodoDeletion(userId, todos[0], [todos[1]])

    const queued = await offlineQueueService.list(userId)
    expect(queued).toHaveLength(1)
    expect(queued[0].resource).toBe('todos')
    expect(queued[0].payload).toEqual({
      items: [todos[1]],
      deleted: [{ id: 'delete-me', version: 7 }],
    })
  })

  it('removes a tombstone when an undo restores the todo', async () => {
    await workspaceSyncService.enqueueTodoDeletion(userId, todos[0], [todos[1]])
    await workspaceSyncService.restoreTodo(userId, todos[0], [todos[1]])
    const queued = await offlineQueueService.list(userId)
    expect(queued[0].payload).toEqual({ items: todos, deleted: [] })
  })

  it('keeps a deletion marker when a later full snapshot arrives', async () => {
    await workspaceSyncService.enqueueTodoDeletion(userId, todos[0], [todos[1]])
    await workspaceSyncService.enqueueTodos(userId, [todos[1]])
    const queued = await offlineQueueService.list(userId)
    expect(queued[0].payload).toEqual({
      items: [todos[1]],
      deleted: [{ id: 'delete-me', version: 7 }],
    })
  })

  it('merges single-note updates without dropping another offline edit', async () => {
    const first = { id: 'note-1', title: 'First', content: 'A' }
    const second = { id: 'note-2', title: 'Second', content: 'B' }
    await workspaceSyncService.enqueueNote(userId, first)
    await workspaceSyncService.enqueueNote(userId, second)
    await workspaceSyncService.enqueueNote(userId, { ...first, content: 'A2' })
    const queued = await offlineQueueService.list(userId)
    expect(queued[0].payload).toEqual({
      items: [second, { ...first, content: 'A2' }],
      deleted: [],
    })
  })

  it('keeps a note deletion marker when a later full snapshot arrives', async () => {
    await workspaceSyncService.enqueueNoteDeletion(userId, notes[0], [notes[1]])
    await workspaceSyncService.enqueueNotes(userId, [notes[1]])
    const queued = await offlineQueueService.list(userId)
    expect(queued[0].payload).toEqual({
      items: [notes[1]],
      deleted: [{ id: 'delete-note', version: 5 }],
    })
  })

  it('removes a note tombstone and strips its stale version when undo restores it', async () => {
    await workspaceSyncService.enqueueNoteDeletion(userId, notes[0], [notes[1]])
    await workspaceSyncService.restoreNote(userId, notes[0], [notes[1]])
    const queued = await offlineQueueService.list(userId)
    expect(queued[0].payload).toEqual({
      items: [{ ...notes[0], version: undefined }, notes[1]],
      deleted: [],
    })
  })
})
