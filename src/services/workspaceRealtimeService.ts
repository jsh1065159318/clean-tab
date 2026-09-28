import { supabaseConfig } from 'config/supabase'
import { requireSupabase } from 'services/supabaseClient'
import { offlineQueueService } from 'services/offlineQueueService'
import { workspaceRepository } from 'repositories/workspaceRepository'
import { settingsStore } from 'features/store/stores/settingsStore'
import { useWorkspaceStore } from 'features/store/workspaceStore'
import type { Note, Shortcut, Todo } from 'features/store/workspaceStore'
import { pendingNoteDeletionService } from 'services/pendingNoteDeletionService'
import { pendingTodoDeletionService } from 'services/pendingTodoDeletionService'

type RealtimeResource = 'todos' | 'note' | 'settings' | 'shortcuts'

const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>()

const timerKey = (userId: string, resource: RealtimeResource) => `${userId}:${resource}`

const sameTodo = (left: Todo, right: Todo) => JSON.stringify({
  id: left.id,
  text: left.text,
  done: left.done,
  priority: left.priority,
  tag: left.tag,
  subtasks: left.subtasks || [],
  updatedAt: left.updatedAt,
  version: left.version,
}) === JSON.stringify({
  id: right.id,
  text: right.text,
  done: right.done,
  priority: right.priority,
  tag: right.tag,
  subtasks: right.subtasks || [],
  updatedAt: right.updatedAt,
  version: right.version,
})

const sameNote = (left: Note, right: Note) =>
  left.id === right.id && left.title === right.title && left.content === right.content &&
  left.updatedAt === right.updatedAt && left.version === right.version

const sameNotes = (left: Note[], right: Note[]) =>
  left.length === right.length && left.every((note, index) => sameNote(note, right[index]))

const sameShortcut = (left: Shortcut, right: Shortcut) =>
  left.id === right.id && left.name === right.name && left.url === right.url &&
  left.emoji === right.emoji && left.color === right.color &&
  left.updatedAt === right.updatedAt && left.version === right.version

const refreshResource = async (userId: string, resource: RealtimeResource): Promise<void> => {
  const pending = await offlineQueueService.list(userId)
  if (pending.some(item => item.resource === resource)) return

  if (resource === 'todos') {
    const pendingIds = new Set(pendingTodoDeletionService.list(userId).map(item => item.id))
    const remote = (await workspaceRepository.listTodos(userId)).filter((todo: Todo) => !pendingIds.has(todo.id))
    const current = useWorkspaceStore.getState().todos
    if (remote.length !== current.length || remote.some((todo: Todo, index: number) => !sameTodo(todo, current[index]))) {
      useWorkspaceStore.getState().replaceTodosFromSync(remote)
    }
    return
  }

  if (resource === 'note') {
    const pendingIds = new Set(pendingNoteDeletionService.list(userId).map(item => item.id))
    const remote = (await workspaceRepository.listNotes(userId))
      .filter((note: Note) => !pendingIds.has(note.id))
    const current = useWorkspaceStore.getState().notes
    if (!sameNotes(remote, current)) useWorkspaceStore.getState().replaceNotesFromSync(remote)
    return
  }

  if (resource === 'settings') {
    const remote = await workspaceRepository.getSettings(userId)
    const current = settingsStore.getSnapshot()
    if (!remote || (Number.isInteger(current.version) && remote.version <= current.version)) return
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
    return
  }

  const remote = await workspaceRepository.listBookmarks(userId)
  const current = useWorkspaceStore.getState().shortcuts
  if (remote.length !== current.length || remote.some((shortcut: Shortcut, index: number) => !sameShortcut(shortcut, current[index]))) {
    useWorkspaceStore.getState().replaceShortcutsFromSync(remote)
  }
}

const scheduleRefresh = (userId: string, resource: RealtimeResource) => {
  const key = timerKey(userId, resource)
  const existing = refreshTimers.get(key)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    refreshTimers.delete(key)
    void refreshResource(userId, resource).catch(error => {
      console.error(`Failed to refresh realtime resource: ${resource}`, error)
    })
  }, 750)
  refreshTimers.set(key, timer)
}

const scheduleAllResources = (userId: string) => {
  scheduleRefresh(userId, 'todos')
  scheduleRefresh(userId, 'note')
  scheduleRefresh(userId, 'settings')
  scheduleRefresh(userId, 'shortcuts')
}

const clearUserTimers = (userId: string) => {
  for (const resource of ['todos', 'note', 'settings', 'shortcuts'] as RealtimeResource[]) {
    const key = timerKey(userId, resource)
    const timer = refreshTimers.get(key)
    if (timer) clearTimeout(timer)
    refreshTimers.delete(key)
  }
}

export const workspaceRealtimeService = {
  subscribe(userId: string): () => void {
    if (!supabaseConfig.isConfigured) return () => undefined

    const client = requireSupabase()
    const channel = client
      .channel(`workspace-sync:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` }, () => {
        scheduleRefresh(userId, 'todos')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` }, () => {
        scheduleRefresh(userId, 'note')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` }, () => {
        scheduleRefresh(userId, 'settings')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookmarks', filter: `user_id=eq.${userId}` }, () => {
        scheduleRefresh(userId, 'shortcuts')
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') scheduleAllResources(userId)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Workspace realtime channel status: ${status}`)
        }
      })

    return () => {
      clearUserTimers(userId)
      void client.removeChannel(channel)
    }
  },
}
