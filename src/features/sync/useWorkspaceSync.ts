import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from 'features/hooks/useAuth'
import { useSettings } from 'features/hooks/useSettings'
import { settingsStore } from 'features/store/stores/settingsStore'
import { useWorkspaceStore } from 'features/store/workspaceStore'
import type { Note, Todo } from 'features/store/workspaceStore'
import { useToastStore } from 'features/toast/toastStore'
import { workspaceRepository } from 'repositories/workspaceRepository'
import { workspaceRealtimeService } from 'services/workspaceRealtimeService'
import { workspaceSyncService } from 'services/workspaceSyncService'
import { pendingNoteDeletionService } from 'services/pendingNoteDeletionService'
import { pendingTodoDeletionService } from 'services/pendingTodoDeletionService'
import type { FlushResult, SettingsPayload } from 'services/workspaceSyncService'

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'queued' | 'error'

interface SettingsSnapshot {
  theme?: string
  version?: number
  greetingName?: string
  searchEngine?: string
  backgroundMode?: string
  backgroundColor?: string
  backgroundImageUrl?: string
  showGreeting?: boolean
  showQuicklinks?: boolean
}

interface AuthUser {
  id?: string
}

const toSettingsPayload = (settings: SettingsSnapshot): SettingsPayload => ({
  theme: settings.theme || 'auto',
  greeting_name: settings.greetingName || '',
  search_engine: settings.searchEngine || 'google',
  background_mode: settings.backgroundMode || 'gradient',
  background_color: settings.backgroundColor || '#111827',
  background_image_url: settings.backgroundImageUrl || '',
  show_greeting: settings.showGreeting ?? true,
  show_quicklinks: settings.showQuicklinks ?? true,
  ...(Number.isInteger(settings.version) ? { version: settings.version } : {}),
})

const sameNoteContent = (left: Note, right: Note) => left.title === right.title && left.content === right.content

export function useWorkspaceSync(): SyncState {
  const auth = useAuth()
  const settings = useSettings()
  const authUser = auth.user as AuthUser | null
  const userId = authUser?.id
  const todos = useWorkspaceStore(state => state.todos)
  const notes = useWorkspaceStore(state => state.notes)
  const shortcuts = useWorkspaceStore(state => state.shortcuts)
  const todoSyncEpoch = useWorkspaceStore(state => state.todoSyncEpoch)
  const notesSyncEpoch = useWorkspaceStore(state => state.notesSyncEpoch)
  const shortcutSyncEpoch = useWorkspaceStore(state => state.shortcutSyncEpoch)
  const replaceTodosFromSync = useWorkspaceStore(state => state.replaceTodosFromSync)
  const replaceNotesFromSync = useWorkspaceStore(state => state.replaceNotesFromSync)
  const replaceShortcutsFromSync = useWorkspaceStore(state => state.replaceShortcutsFromSync)
  const showToast = useToastStore(state => state.showToast)
  const [syncState, setSyncState] = useState<SyncState>('local')
  const readyUserRef = useRef<string | null>(null)
  const handledTodoEpochRef = useRef(0)
  const handledNoteEpochRef = useRef(0)
  const handledShortcutEpochRef = useRef(0)
  const previousNotesRef = useRef(notes)

  const applyFlushResult = useCallback((result: FlushResult) => {
    if (result.conflicts > 0) {
      setSyncState('synced')
      showToast('检测到多设备修改，已保留本地内容并完成合并', 'info')
      return
    }
    if (result.offline) {
      setSyncState('offline')
      return
    }
    if (result.failed > 0 || result.remaining > 0) {
      setSyncState('queued')
      return
    }
    setSyncState('synced')
  }, [showToast])

  useEffect(() => {
    if (!userId) {
      readyUserRef.current = null
      setSyncState('local')
      return
    }

    let cancelled = false
    setSyncState('syncing')

    const loadCloudData = async () => {
      const localWorkspace = useWorkspaceStore.getState()
      const localSettings = settingsStore.getSnapshot()
      const localSettingsEpoch = settingsStore.getLocalEpoch()
      const pendingTodoDeletions = pendingTodoDeletionService.list(userId)
      const pendingTodoDeletionIds = new Set(pendingTodoDeletions.map(item => item.id))
      const pendingNoteDeletions = pendingNoteDeletionService.list(userId)
      const pendingNoteDeletionIds = new Set(pendingNoteDeletions.map(item => item.id))

      try {
        const pendingResources = await workspaceSyncService.pendingResources(userId)
        if (!navigator.onLine) {
          const currentWorkspace = useWorkspaceStore.getState()
          const currentSettings = settingsStore.getSnapshot()
          await Promise.all([
            workspaceSyncService.enqueueTodos(userId, currentWorkspace.todos),
            ...pendingTodoDeletions.map(deletion => workspaceSyncService.enqueueTodoDeletionMarker(
              userId,
              deletion,
              currentWorkspace.todos,
            )),
            workspaceSyncService.enqueueNotes(userId, currentWorkspace.notes),
            ...pendingNoteDeletions.map(deletion => workspaceSyncService.enqueueNoteDeletionMarker(
              userId,
              deletion,
              currentWorkspace.notes,
            )),
            workspaceSyncService.enqueueShortcuts(userId, currentWorkspace.shortcuts),
            workspaceSyncService.enqueueSettings(userId, toSettingsPayload(currentSettings)),
          ])
          readyUserRef.current = userId
          setSyncState('offline')
          return
        }

        const [remoteTodosResult, remoteNotesResult, remoteShortcuts, remoteSettings] = await Promise.all([
          workspaceRepository.listTodos(userId),
          workspaceRepository.listNotes(userId),
          workspaceRepository.listBookmarks(userId),
          pendingResources.has('settings') ? null : workspaceRepository.getSettings(userId),
        ])
        if (cancelled) return
        const remoteTodos = remoteTodosResult.filter((todo: Todo) => !pendingTodoDeletionIds.has(todo.id))
        const remoteNotes = remoteNotesResult.filter((note: Note) => !pendingNoteDeletionIds.has(note.id))
        const todosChangedLocally = () => useWorkspaceStore.getState().todoLocalEpoch !== localWorkspace.todoLocalEpoch
        const notesChangedLocally = () => useWorkspaceStore.getState().notesLocalEpoch !== localWorkspace.notesLocalEpoch
        const shortcutsChangedLocally = () => useWorkspaceStore.getState().shortcutLocalEpoch !== localWorkspace.shortcutLocalEpoch
        const settingsChangedLocally = () => settingsStore.getLocalEpoch() !== localSettingsEpoch
        const enqueueLocalChanges = () => {
          const currentWorkspace = useWorkspaceStore.getState()
          const currentSettings = settingsStore.getSnapshot()
          const operations: Promise<unknown>[] = []
          if (todosChangedLocally()) operations.push(workspaceSyncService.enqueueTodos(userId, currentWorkspace.todos))
          pendingTodoDeletions.forEach(deletion => operations.push(
            workspaceSyncService.enqueueTodoDeletionMarker(userId, deletion, currentWorkspace.todos),
          ))
          if (notesChangedLocally()) operations.push(workspaceSyncService.enqueueNotes(userId, currentWorkspace.notes))
          pendingNoteDeletions.forEach(deletion => operations.push(
            workspaceSyncService.enqueueNoteDeletionMarker(userId, deletion, currentWorkspace.notes),
          ))
          if (shortcutsChangedLocally()) operations.push(workspaceSyncService.enqueueShortcuts(userId, currentWorkspace.shortcuts))
          if (settingsChangedLocally()) operations.push(workspaceSyncService.enqueueSettings(userId, toSettingsPayload(currentSettings)))
          return Promise.all(operations)
        }

        if (!todosChangedLocally() && !pendingResources.has('todos')) {
          if (remoteTodos.length > 0) replaceTodosFromSync(remoteTodos)
          else {
            const uploadedTodos = await workspaceRepository.upsertTodos(userId, localWorkspace.todos)
            if (!todosChangedLocally()) replaceTodosFromSync(uploadedTodos)
          }
        }

        if (!notesChangedLocally() && !pendingResources.has('note')) {
          if (remoteNotes.length > 0) replaceNotesFromSync(remoteNotes)
          else if (localWorkspace.notes.length > 0) {
            const uploadedNotes = await workspaceRepository.upsertNotes(userId, localWorkspace.notes)
            if (!notesChangedLocally()) replaceNotesFromSync(uploadedNotes)
          }
        }

        if (!shortcutsChangedLocally() && !pendingResources.has('shortcuts')) {
          if (remoteShortcuts.length > 0) replaceShortcutsFromSync(remoteShortcuts)
          else {
            const uploadedShortcuts = await workspaceRepository.upsertBookmarks(userId, localWorkspace.shortcuts)
            if (!shortcutsChangedLocally()) replaceShortcutsFromSync(uploadedShortcuts)
          }
        }

        if (!settingsChangedLocally() && remoteSettings) {
          settingsStore.replaceFromSync({
            theme: remoteSettings.theme,
            greetingName: remoteSettings.greeting_name,
            searchEngine: remoteSettings.search_engine,
            backgroundMode: remoteSettings.background_mode,
            backgroundColor: remoteSettings.background_color,
            backgroundImageUrl: remoteSettings.background_image_url,
            showGreeting: remoteSettings.show_greeting,
            showQuicklinks: remoteSettings.show_quicklinks,
            version: remoteSettings.version,
          })
        } else if (!settingsChangedLocally() && !pendingResources.has('settings')) {
          await workspaceRepository.updateSettings(userId, toSettingsPayload(localSettings))
        }

        await enqueueLocalChanges()
        readyUserRef.current = userId
        await enqueueLocalChanges()
        applyFlushResult(await workspaceSyncService.flush(userId))
      } catch (error) {
        const currentWorkspace = useWorkspaceStore.getState()
        const currentSettings = settingsStore.getSnapshot()
        await Promise.allSettled([
          workspaceSyncService.enqueueTodos(userId, currentWorkspace.todos),
          ...pendingTodoDeletions.map(deletion => workspaceSyncService.enqueueTodoDeletionMarker(
            userId,
            deletion,
            currentWorkspace.todos,
          )),
          workspaceSyncService.enqueueNotes(userId, currentWorkspace.notes),
          ...pendingNoteDeletions.map(deletion => workspaceSyncService.enqueueNoteDeletionMarker(
            userId,
            deletion,
            currentWorkspace.notes,
          )),
          workspaceSyncService.enqueueShortcuts(userId, currentWorkspace.shortcuts),
          workspaceSyncService.enqueueSettings(userId, toSettingsPayload(currentSettings)),
        ])
        if (!cancelled) {
          readyUserRef.current = userId
          setSyncState('queued')
          showToast('云端暂不可用，内容已保存在本地', 'error')
        }
        console.error('Failed to load workspace data:', error)
      }
    }

    void loadCloudData()
    return () => {
      cancelled = true
    }
  }, [applyFlushResult, replaceNotesFromSync, replaceShortcutsFromSync, replaceTodosFromSync, showToast, userId])

  useEffect(() => {
    if (!userId || readyUserRef.current !== userId) return
    if (todoSyncEpoch !== handledTodoEpochRef.current) {
      handledTodoEpochRef.current = todoSyncEpoch
      return
    }
    setSyncState(navigator.onLine ? 'queued' : 'offline')
    const timer = window.setTimeout(async () => {
      try {
        await workspaceSyncService.enqueueTodos(userId, todos)
        await Promise.all(pendingTodoDeletionService.list(userId).map(deletion => (
          workspaceSyncService.enqueueTodoDeletionMarker(userId, deletion, todos)
        )))
        setSyncState(navigator.onLine ? 'syncing' : 'offline')
        applyFlushResult(await workspaceSyncService.flush(userId))
      } catch (error) {
        setSyncState('queued')
        console.error('Failed to sync todos:', error)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [applyFlushResult, todoSyncEpoch, todos, userId])

  useEffect(() => {
    const previousNotes = previousNotesRef.current
    previousNotesRef.current = notes
    if (!userId || readyUserRef.current !== userId) return
    if (notesSyncEpoch !== handledNoteEpochRef.current) {
      handledNoteEpochRef.current = notesSyncEpoch
      return
    }
    const changedNotes = notes.filter(note => {
      const previous = previousNotes.find(item => item.id === note.id)
      return !previous || !sameNoteContent(previous, note)
    })
    const deletedNotes = previousNotes.filter(note => !notes.some(item => item.id === note.id))
    deletedNotes.forEach(note => pendingNoteDeletionService.mark(userId, note.id, note.version))
    setSyncState(navigator.onLine ? 'queued' : 'offline')
    const timer = window.setTimeout(async () => {
      try {
        await Promise.all([
          ...changedNotes.map(note => workspaceSyncService.enqueueNote(userId, note)),
          ...deletedNotes.map(note => workspaceSyncService.enqueueNoteDeletion(userId, note, notes)),
          ...pendingNoteDeletionService.list(userId).map(deletion => (
            workspaceSyncService.enqueueNoteDeletionMarker(userId, deletion, notes)
          )),
        ])
        setSyncState(navigator.onLine ? 'syncing' : 'offline')
        applyFlushResult(await workspaceSyncService.flush(userId))
      } catch (error) {
        setSyncState('queued')
        console.error('Failed to sync notes:', error)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [applyFlushResult, notes, notesSyncEpoch, userId])

  useEffect(() => {
    if (!userId || readyUserRef.current !== userId) return
    if (shortcutSyncEpoch !== handledShortcutEpochRef.current) {
      handledShortcutEpochRef.current = shortcutSyncEpoch
      return
    }
    setSyncState(navigator.onLine ? 'queued' : 'offline')
    const timer = window.setTimeout(async () => {
      try {
        await workspaceSyncService.enqueueShortcuts(userId, shortcuts)
        setSyncState(navigator.onLine ? 'syncing' : 'offline')
        applyFlushResult(await workspaceSyncService.flush(userId))
      } catch (error) {
        setSyncState('queued')
        console.error('Failed to sync shortcuts:', error)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [applyFlushResult, shortcutSyncEpoch, shortcuts, userId])

  useEffect(() => {
    if (!userId || readyUserRef.current !== userId) return
    setSyncState(navigator.onLine ? 'queued' : 'offline')
    const timer = window.setTimeout(async () => {
      try {
        await workspaceSyncService.enqueueSettings(userId, toSettingsPayload(settings))
        setSyncState(navigator.onLine ? 'syncing' : 'offline')
        applyFlushResult(await workspaceSyncService.flush(userId))
      } catch (error) {
        setSyncState('queued')
        console.error('Failed to sync settings:', error)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [applyFlushResult, settings, userId])

  useEffect(() => {
    if (!userId) return undefined
    return workspaceRealtimeService.subscribe(userId)
  }, [userId])

  useEffect(() => {
    const handleOffline = () => setSyncState(userId ? 'offline' : 'local')
    const handleOnline = async () => {
      if (!userId) return
      setSyncState('syncing')
      try {
        applyFlushResult(await workspaceSyncService.flush(userId))
      } catch (error) {
        setSyncState('queued')
        console.error('Failed to resume workspace sync:', error)
      }
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [applyFlushResult, userId])

  return syncState
}
