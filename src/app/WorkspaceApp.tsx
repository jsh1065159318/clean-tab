import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  MdCheckCircleOutline,
  MdBuild,
  MdCloudDone,
  MdCloudOff,
  MdDarkMode,
  MdHome,
  MdLightMode,
  MdLogout,
  MdNotes,
  MdPersonOutline,
  MdSettings,
  MdSync,
  MdTimer,
} from 'react-icons/md'
import type { IconType } from 'react-icons'
import { appConfig } from 'config/app'
import { backendConfig } from 'config/backend'
import { STORAGE_KEYS } from 'constants/storageKeys'
import { HomeView } from 'features/dashboard/HomeView'
import type { ShortcutDraft } from 'features/dashboard/ShortcutEditorModal'
import { useSettings } from 'features/hooks/useSettings'
import { useFocusTimer } from 'features/focus/useFocusTimer'
import type { FocusMode } from 'features/focus/useFocusTimer'
import { settingsStore } from 'features/store/stores/settingsStore'
import { useWorkspaceStore } from 'features/store/workspaceStore'
import type { Shortcut } from 'features/store/workspaceStore'
import type { SyncState } from 'features/sync/useWorkspaceSync'
import { SyncStatusPanel } from 'features/sync/SyncStatusPanel'
import { syncLabels } from 'features/sync/syncState'
import { usePopover } from 'features/hooks/usePopover'
import type { CloudState } from 'features/sync/CloudBridge'
import { removeTodo } from 'features/tasks/removeTodo'
import { ToastViewport } from 'features/toast/ToastViewport'
import { useToastStore } from 'features/toast/toastStore'
import { STORAGE_ERROR_EVENT, storageService } from 'services/storageService'
import { pendingNoteDeletionService } from 'services/pendingNoteDeletionService'
import { pendingTodoDeletionService } from 'services/pendingTodoDeletionService'
import { recentSearchService } from 'services/recentSearchService'
import { startWorkspaceBroadcast } from 'services/workspaceBroadcastService'
import { createId } from 'utils/createId'
import { parseCaptureParams } from 'utils/parseCaptureParams'
import { parseNavigableUrl } from 'utils/parseNavigableUrl'
import { reorderById } from 'utils/reorderById'
import { resolveSearchInput } from 'utils/resolveSearchInput'
import { extensionApi } from 'lib/extensionApi'

type View = 'home' | 'tasks' | 'notes' | 'tools' | 'settings' | 'focus'
type Theme = 'auto' | 'light' | 'dark'

interface AuthUser {
  id?: string
  email?: string
  displayName?: string
}

const AuthModal = lazy(() => import('../components/auth/AuthModal').then(module => ({ default: module.AuthModal })))
const CloudBridge = lazy(() => import('features/sync/CloudBridge').then(module => ({ default: module.CloudBridge })))
const CommandPalette = lazy(() => import('features/command/CommandPalette').then(module => ({ default: module.CommandPalette })))
const ShortcutEditorModal = lazy(() => import('features/dashboard/ShortcutEditorModal').then(module => ({ default: module.ShortcutEditorModal })))
const NotesView = lazy(() => import('features/notes/NotesView').then(module => ({ default: module.NotesView })))
const SettingsView = lazy(() => import('features/settings/SettingsView').then(module => ({ default: module.SettingsView })))
const TasksView = lazy(() => import('features/tasks/TasksView').then(module => ({ default: module.TasksView })))
const ToolsView = lazy(() => import('features/tools/ToolsView').then(module => ({ default: module.ToolsView })))
const FocusView = lazy(() => import('features/focus/FocusView').then(module => ({ default: module.FocusView })))

const ViewLoading = () => <div className="view-loading" role="status" aria-live="polite">正在加载...</div>

const navigationItems = [
  { id: 'home', label: '首页', icon: MdHome },
  { id: 'tasks', label: '任务', icon: MdCheckCircleOutline },
  { id: 'notes', label: '笔记', icon: MdNotes },
  { id: 'tools', label: '工具', icon: MdBuild },
] as const

const noopRetry = () => Promise.resolve()

const syncIcons: Record<SyncState, IconType> = {
  local: MdCloudOff,
  syncing: MdSync,
  synced: MdCloudDone,
  offline: MdCloudOff,
  queued: MdSync,
  error: MdCloudOff,
}

const getResolvedTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme !== 'auto') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function WorkspaceApp() {
  const settings = useSettings()
  const [cloudState, setCloudState] = useState<CloudState>(() => ({
    auth: { status: backendConfig.isConfigured ? 'loading' : 'unconfigured', user: null },
    syncState: 'local',
    retry: noopRetry,
  }))
  const auth = cloudState.auth
  const authUser = auth.user as AuthUser | null
  const syncState = cloudState.syncState
  const todos = useWorkspaceStore(state => state.todos)
  const notes = useWorkspaceStore(state => state.notes)
  const shortcuts = useWorkspaceStore(state => state.shortcuts)
  const setTodos = useWorkspaceStore(state => state.setTodos)
  const setNotes = useWorkspaceStore(state => state.setNotes)
  const hydrateNotesFromBodyStorage = useWorkspaceStore(state => state.hydrateNotesFromBodyStorage)
  const setShortcuts = useWorkspaceStore(state => state.setShortcuts)
  const showToast = useToastStore(state => state.showToast)
  const handleFocusComplete = useCallback((mode: FocusMode) => {
    showToast(mode === 'focus' ? '本轮专注已完成' : '休息结束，可以继续了', 'info')
  }, [showToast])
  const focusTimer = useFocusTimer(handleFocusComplete)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const accountMenu = usePopover<HTMLDivElement, HTMLButtonElement>()
  const syncMenu = usePopover<HTMLDivElement, HTMLButtonElement>()
  const shortcutEditorTriggerRef = useRef<HTMLElement | null>(null)
  const [view, setView] = useState<View>('home')
  const [focusTaskId, setFocusTaskId] = useState(() => storageService.getJSON<string>(STORAGE_KEYS.focusTaskId, ''))
  const [search, setSearch] = useState('')
  const [recentSearches, setRecentSearches] = useState(() => (
    settings.saveSearchHistory ? recentSearchService.list() : []
  ))
  const [shortcutEditorOpen, setShortcutEditorOpen] = useState(false)
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const captureHandledRef = useRef(false)
  const [favoriteToolIds, setFavoriteToolIds] = useState<string[]>(() => {
    return storageService.getValidatedJSON(STORAGE_KEYS.favoriteTools, [], value => (
      Array.isArray(value) ? value.filter(item => typeof item === 'string') : null
    ))
  })
  const [resolvedTheme, setResolvedTheme] = useState(() => getResolvedTheme((settings.theme || 'auto') as Theme))
  const updateCloudState = useCallback((state: CloudState) => setCloudState(state), [])

  const updateFocusTask = (id: string) => {
    setFocusTaskId(id)
    storageService.setJSON(STORAGE_KEYS.focusTaskId, id)
  }

  const displayName = useMemo(() => (
    settings.greetingName?.trim()
    || authUser?.displayName
    || authUser?.email?.split('@')[0]
    || ''
  ), [authUser?.displayName, authUser?.email, settings.greetingName])

  useEffect(() => {
    const theme = (settings.theme || 'auto') as Theme
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => setResolvedTheme(getResolvedTheme(theme))
    updateTheme()
    media.addEventListener('change', updateTheme)
    return () => media.removeEventListener('change', updateTheme)
  }, [settings.theme])

  useEffect(() => {
    if (settings.backgroundMode !== 'image' || !settings.backgroundImageUrl) return undefined
    const image = new Image()
    image.onerror = () => {
      settingsStore.update({ backgroundMode: 'gradient', backgroundImageUrl: '' })
      showToast('背景图片加载失败，已回退到渐变背景', 'error')
    }
    image.src = settings.backgroundImageUrl
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [settings.backgroundImageUrl, settings.backgroundMode, showToast])

  useEffect(() => {
    setRecentSearches(settings.saveSearchHistory
      ? recentSearchService.list()
      : recentSearchService.clear())
  }, [settings.saveSearchHistory])

  useEffect(() => {
    const openCommandPalette = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', openCommandPalette)
    return () => window.removeEventListener('keydown', openCommandPalette)
  }, [])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || target?.matches('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      setView('home')
      window.setTimeout(() => searchInputRef.current?.focus(), 0)
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    const showStorageError = () => showToast('浏览器存储暂不可用，请及时导出数据', 'error')
    if (storageService.getLastError()) showStorageError()
    window.addEventListener(STORAGE_ERROR_EVENT, showStorageError)
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, showStorageError)
  }, [showToast])

  useEffect(() => {
    void hydrateNotesFromBodyStorage().catch(error => {
      console.error('Failed to hydrate note bodies:', error)
    })
  }, [hydrateNotesFromBodyStorage])

  useEffect(() => startWorkspaceBroadcast(resource => {
    const labels = { todos: '任务', notes: '笔记', shortcuts: '快捷方式' } as const
    showToast(`已同步其他标签页的${labels[resource]}修改`, 'info')
  }), [showToast])

  useEffect(() => {
    if (focusTaskId && !todos.some(todo => todo.id === focusTaskId && !todo.done)) updateFocusTask('')
  }, [focusTaskId, todos])

  const addTodo = (text: string) => {
    setTodos(current => [{
      id: createId(),
      text,
      done: false,
      priority: 'medium',
      tag: '',
      subtasks: [],
      updatedAt: new Date().toISOString(),
    }, ...current])
  }

  useEffect(() => {
    if (captureHandledRef.current || !extensionApi.isExtension()) return
    const capture = parseCaptureParams(window.location.search)
    if (!capture) return
    captureHandledRef.current = true
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    if (capture.mode === 'task') {
      setTodos(current => [{
        id: createId(),
        text: capture.title || capture.url,
        done: false,
        priority: 'medium',
        tag: '',
        subtasks: [],
        updatedAt: new Date().toISOString(),
      }, ...current])
      setView('tasks')
      showToast('当前页面已保存为任务')
      return
    }
    setShortcuts(current => {
      if (current.some(shortcut => shortcut.url === capture.url)) return current
      return [...current, {
        id: createId(),
        name: capture.title || new URL(capture.url).hostname,
        url: capture.url,
        emoji: '↗',
        color: '#6366f1',
        updatedAt: new Date().toISOString(),
      }]
    })
    showToast('当前页面已保存为快捷方式')
  }, [setShortcuts, setTodos, showToast])

  const toggleTodo = (id: string) => {
    setTodos(current => current.map(todo => (
      todo.id === id ? { ...todo, done: !todo.done, updatedAt: new Date().toISOString() } : todo
    )))
  }

  const updateTodo = (updatedTodo: typeof todos[number]) => {
    setTodos(current => current.map(todo => (
      todo.id === updatedTodo.id
        ? { ...updatedTodo, updatedAt: new Date().toISOString() }
        : todo
    )))
  }

  const deleteTodo = (id: string) => {
    const removal = removeTodo(todos, id)
    if (!removal) return
    const { deletedTodo, remainingTodos } = removal
    const userId = authUser?.id
    if (userId) pendingTodoDeletionService.mark(userId, deletedTodo.id, deletedTodo.version)
    setTodos(remainingTodos)
    if (userId) {
      void import('services/workspaceSyncService')
        .then(({ workspaceSyncService }) => workspaceSyncService
          .enqueueTodoDeletion(userId, deletedTodo, remainingTodos)
          .then(() => workspaceSyncService.flush(userId)))
        .catch(error => console.error('Failed to delete todo:', error))
    }
    const undoTodo = () => {
      const nextTodos = useWorkspaceStore.getState().todos
      if (nextTodos.some(todo => todo.id === deletedTodo.id)) return
      const restoredTodos = [deletedTodo, ...nextTodos]
      if (userId) pendingTodoDeletionService.clear(userId, [deletedTodo.id])
      setTodos(restoredTodos)
      if (userId) {
        void import('services/workspaceSyncService')
          .then(({ workspaceSyncService }) => workspaceSyncService
            .restoreTodo(userId, deletedTodo, nextTodos)
            .then(() => workspaceSyncService.flush(userId)))
          .catch(error => console.error('Failed to restore todo:', error))
      }
      showToast('任务已恢复')
    }
    showToast('任务已删除', 'info', { label: '撤销', onClick: undoTodo })
  }

  const createNote = () => {
    const id = createId()
    const now = new Date().toISOString()
    setNotes(current => [{ id, title: '未命名笔记', content: '', createdAt: now, updatedAt: now }, ...current])
    return id
  }

  const updateNote = (updatedNote: typeof notes[number]) => {
    const nextNote = { ...updatedNote, updatedAt: new Date().toISOString() }
    setNotes(current => [nextNote, ...current.filter(note => note.id !== updatedNote.id)])
  }

  const deleteNote = (deletedNote: typeof notes[number]) => {
    if (!notes.some(note => note.id === deletedNote.id)) return
    const remainingNotes = notes.filter(note => note.id !== deletedNote.id)
    const userId = authUser?.id
    if (userId) pendingNoteDeletionService.mark(userId, deletedNote.id, deletedNote.version)
    setNotes(remainingNotes)
    if (userId) {
      void import('services/workspaceSyncService')
        .then(({ workspaceSyncService }) => workspaceSyncService
          .enqueueNoteDeletion(userId, deletedNote, remainingNotes)
          .then(() => workspaceSyncService.flush(userId)))
        .catch(error => console.error('Failed to delete note:', error))
    }
    const undoNote = () => {
      const nextNotes = useWorkspaceStore.getState().notes
      if (nextNotes.some(note => note.id === deletedNote.id)) return
      const restoredNotes = [deletedNote, ...nextNotes]
      if (userId) pendingNoteDeletionService.clear(userId, [deletedNote.id])
      setNotes(restoredNotes)
      if (userId) {
        void import('services/workspaceSyncService')
          .then(({ workspaceSyncService }) => workspaceSyncService
            .restoreNote(userId, deletedNote, nextNotes)
            .then(() => workspaceSyncService.flush(userId)))
          .catch(error => console.error('Failed to restore note:', error))
      }
      showToast('笔记已恢复')
    }
    showToast('笔记已删除', 'info', { label: '撤销', onClick: undoNote })
  }

  const navigateSearch = (value: string) => {
    const resolved = resolveSearchInput(value, settings.searchEngine)
    if (!resolved) return
    if (settings.saveSearchHistory && resolved.historyValue) {
      setRecentSearches(recentSearchService.add(resolved.historyValue))
    }
    window.location.assign(resolved.target)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigateSearch(search)
  }

  const openShortcut = (shortcut: Shortcut) => {
    const url = parseNavigableUrl(shortcut.url)
    if (!url) {
      showToast('快捷方式地址无效', 'error')
      return
    }
    window.location.assign(url)
  }

  const openShortcutEditor = (shortcut: Shortcut | null = null) => {
    const activeElement = document.activeElement as HTMLElement | null
    shortcutEditorTriggerRef.current = activeElement?.closest('.shortcut-menu-wrap')
      ?.querySelector<HTMLElement>('.shortcut-menu-toggle')
      || (activeElement?.closest('.command-palette') ? document.querySelector<HTMLElement>('.brand') : activeElement)
    setEditingShortcut(shortcut)
    setShortcutEditorOpen(true)
  }

  const closeShortcutEditor = () => {
    setShortcutEditorOpen(false)
    setEditingShortcut(null)
    window.requestAnimationFrame(() => shortcutEditorTriggerRef.current?.focus())
  }

  const saveShortcut = (draft: ShortcutDraft) => {
    const normalizedUrl = parseNavigableUrl(draft.url)
    if (!normalizedUrl) {
      showToast('请输入有效的网址', 'error')
      return
    }
    if (editingShortcut) {
      setShortcuts(current => current.map(shortcut => (
        shortcut.id === editingShortcut.id
          ? { ...shortcut, ...draft, url: normalizedUrl, updatedAt: new Date().toISOString() }
          : shortcut
      )))
    } else {
      setShortcuts(current => [...current, {
        id: createId(),
        ...draft,
        url: normalizedUrl,
        updatedAt: new Date().toISOString(),
      }])
    }
    closeShortcutEditor()
    showToast(editingShortcut ? '快捷方式已更新' : '快捷方式已添加')
  }

  const deleteShortcut = (shortcut: Shortcut) => {
    const remainingShortcuts = shortcuts.filter(item => item.id !== shortcut.id)
    setShortcuts(remainingShortcuts)
    if (authUser?.id) {
      const userId = authUser.id
      void import('services/workspaceSyncService')
        .then(({ workspaceSyncService }) => workspaceSyncService
          .enqueueShortcutDeletion(userId, shortcut, remainingShortcuts)
          .then(() => workspaceSyncService.flush(userId)))
        .catch(error => console.error('Failed to delete shortcut:', error))
    }
    showToast(`已删除 ${shortcut.name}`, 'info')
  }

  const reorderShortcut = (draggedId: string, targetId: string) => {
    setShortcuts(current => reorderById(current, draggedId, targetId))
  }

  const toggleTheme = () => {
    settingsStore.update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })
  }

  const toggleToolFavorite = (toolId: string) => {
    setFavoriteToolIds(current => {
      const next = current.includes(toolId) ? current.filter(id => id !== toolId) : [...current, toolId]
      storageService.setJSON(STORAGE_KEYS.favoriteTools, next)
      return next
    })
  }

  const resetSettings = () => {
    settingsStore.reset()
    setRecentSearches(recentSearchService.clear())
    showToast('设置已恢复默认值')
  }

  const updateSettings = (patch: Record<string, unknown>) => {
    if (patch.saveSearchHistory === false) setRecentSearches(recentSearchService.clear())
    settingsStore.update(patch)
  }

  const exportBackup = async () => {
    const { createBackupJson } = await import('services/backupService')
    const source = createBackupJson({
      favoriteToolIds,
      notes,
      settings,
      shortcuts,
      todos,
    })
    const href = URL.createObjectURL(new Blob([source], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = href
    link.download = `clean-tab-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(href), 0)
    showToast('备份已导出')
  }

  const focusSearch = () => {
    setView('home')
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const createNoteFromCommand = () => {
    setView('notes')
    createNote()
  }

  const importBackup = async (file: File, strategy: 'merge' | 'replace') => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能超过 5 MB。')
      const { parseBackupJson } = await import('services/backupService')
      const backup = parseBackupJson(await file.text())
      const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
        const incomingIds = new Set(incoming.map(item => item.id))
        return [...incoming, ...current.filter(item => !incomingIds.has(item.id))]
      }
      const nextTodos = strategy === 'merge' ? mergeById(todos, backup.todos) : backup.todos
      const nextNotes = strategy === 'merge' ? mergeById(notes, backup.notes) : backup.notes
      const nextShortcuts = strategy === 'merge' ? mergeById(shortcuts, backup.shortcuts) : backup.shortcuts
      const nextFavorites = strategy === 'merge'
        ? Array.from(new Set([...favoriteToolIds, ...backup.favoriteToolIds]))
        : backup.favoriteToolIds

      setTodos(nextTodos)
      setNotes(nextNotes)
      setShortcuts(nextShortcuts)
      setFavoriteToolIds(nextFavorites)
      storageService.setJSON(STORAGE_KEYS.favoriteTools, nextFavorites)
      settingsStore.update(backup.settings)

      if (authUser?.id && strategy === 'replace') {
        const userId = authUser.id
        const { workspaceSyncService } = await import('services/workspaceSyncService')
        const nextTodoIds = new Set(nextTodos.map(item => item.id))
        const nextNoteIds = new Set(nextNotes.map(item => item.id))
        const nextShortcutIds = new Set(nextShortcuts.map(item => item.id))
        for (const todo of todos.filter(item => !nextTodoIds.has(item.id))) {
          await workspaceSyncService.enqueueTodoDeletion(userId, todo, nextTodos)
        }
        for (const note of notes.filter(item => !nextNoteIds.has(item.id))) {
          await workspaceSyncService.enqueueNoteDeletion(userId, note, nextNotes)
        }
        for (const shortcut of shortcuts.filter(item => !nextShortcutIds.has(item.id))) {
          await workspaceSyncService.enqueueShortcutDeletion(userId, shortcut, nextShortcuts)
        }
        void workspaceSyncService.flush(userId)
      }
      showToast(`备份已${strategy === 'merge' ? '合并' : '恢复'}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法导入备份文件', 'error')
    }
  }

  const accountAction = () => {
    if (auth.status === 'loading') return
    if (auth.status === 'authenticated') {
      accountMenu.toggle()
    } else if (auth.status === 'unconfigured') {
      setView('settings')
    } else {
      setAuthModalOpen(true)
    }
  }

  const logout = async () => {
    accountMenu.close()
    let formatError = (_error: unknown) => '退出失败，请稍后重试'
    try {
      const { authService, getAuthErrorMessage } = await import('services/authService')
      formatError = error => getAuthErrorMessage(error, '退出失败，请稍后重试')
      await authService.signOut()
      showToast('已退出登录，本地内容会继续保留', 'info')
    } catch (error) {
      showToast(formatError(error), 'error')
    }
  }

  const backgroundStyle = useMemo<CSSProperties>(() => {
    if (settings.backgroundMode === 'image' && settings.backgroundImageUrl) {
      return { backgroundImage: `linear-gradient(rgb(8 15 28 / 28%), rgb(8 15 28 / 28%)), url("${settings.backgroundImageUrl}")` }
    }
    if (settings.backgroundMode === 'color') return { background: settings.backgroundColor || '#111827' }
    return {}
  }, [settings.backgroundColor, settings.backgroundImageUrl, settings.backgroundMode])

  const SyncIcon = syncIcons[syncState]

  return (
    <div className="newtab-shell" data-theme={resolvedTheme} style={backgroundStyle}>
      <header className="newtab-header">
        <button className="brand" type="button" onClick={() => setView('home')} aria-label="返回首页">
          <span>C</span>
          <strong>{appConfig.name}</strong>
        </button>

        <nav className="primary-nav" aria-label="主要导航">
          {navigationItems.map(item => {
            const Icon = item.icon
            return (
              <button
                className={view === item.id ? 'is-active' : ''}
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="header-actions">
          <div className="sync-menu-wrap" ref={syncMenu.containerRef}>
            <button
              ref={syncMenu.triggerRef}
              className={`sync-status sync-${syncState}`}
              type="button"
              title={syncLabels[syncState]}
              aria-label={`同步状态：${syncLabels[syncState]}`}
              aria-expanded={syncMenu.open}
              aria-controls="sync-panel"
              onClick={syncMenu.toggle}
            >
              <SyncIcon />
              <span>{syncLabels[syncState]}</span>
            </button>
            {syncMenu.open && (
              <div className="sync-popover" id="sync-panel">
                <SyncStatusPanel
                  syncState={syncState}
                  signedIn={auth.status === 'authenticated'}
                  userId={authUser?.id ?? ''}
                  onRetry={cloudState.retry}
                  onLogin={() => {
                    syncMenu.close()
                    setAuthModalOpen(true)
                  }}
                  onOpenSettings={() => {
                    syncMenu.close()
                    setView('settings')
                  }}
                />
              </div>
            )}
          </div>
          <button className="icon-button" type="button" onClick={toggleTheme} aria-label="切换主题">
            {resolvedTheme === 'dark' ? <MdLightMode /> : <MdDarkMode />}
          </button>
          <button className={`icon-button${view === 'focus' ? ' is-active' : ''}`} type="button" onClick={() => setView('focus')} aria-label="打开专注模式" title="专注模式">
            <MdTimer />
          </button>
          <button className="icon-button" type="button" onClick={() => setView('settings')} aria-label="打开设置">
            <MdSettings />
          </button>
          <div className="account-menu-wrap" ref={accountMenu.containerRef}>
            <button ref={accountMenu.triggerRef} className="avatar-button" disabled={auth.status === 'loading'} type="button" onClick={accountAction} aria-label={auth.status === 'loading' ? '正在恢复登录状态' : '账户'} aria-expanded={accountMenu.open} aria-controls="account-popover">
              {displayName.slice(0, 1) || <MdPersonOutline />}
            </button>
            {accountMenu.open && auth.status === 'authenticated' && (
              <div className="account-popover" id="account-popover">
                <strong>{displayName || '我的账号'}</strong>
                <span>{authUser?.email}</span>
                <button type="button" onClick={() => void logout()}>
                  <MdLogout /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="newtab-content">
        <Suspense fallback={<ViewLoading />}>
          {view === 'home' && (
            <HomeView
              displayName={displayName}
              recentSearches={settings.saveSearchHistory ? recentSearches : []}
              search={search}
              searchInputRef={searchInputRef}
              shortcuts={shortcuts}
              showGreeting={settings.showGreeting ?? true}
              showQuicklinks={settings.showQuicklinks ?? true}
              todos={todos}
              onAddShortcut={() => openShortcutEditor()}
              onAddTodo={addTodo}
              onClearRecentSearches={() => setRecentSearches(recentSearchService.clear())}
              onDeleteShortcut={deleteShortcut}
              onEditShortcut={openShortcutEditor}
              onOpenShortcut={openShortcut}
              onOpenTasks={() => setView('tasks')}
              onReorderShortcut={reorderShortcut}
              onSearchChange={setSearch}
              onSearchKeySubmit={() => navigateSearch(search)}
              onSearchSelect={value => {
                setSearch(value)
                navigateSearch(value)
              }}
              onSearchSubmit={submitSearch}
              onToggleTodo={toggleTodo}
            />
          )}
          {view === 'tasks' && <TasksView todos={todos} onAdd={addTodo} onDelete={deleteTodo} onToggle={toggleTodo} onUpdate={updateTodo} />}
          {view === 'notes' && <NotesView notes={notes} onCreate={createNote} onDelete={deleteNote} onUpdate={updateNote} />}
          {view === 'tools' && <ToolsView favoriteToolIds={favoriteToolIds} onToggleFavorite={toggleToolFavorite} />}
          {view === 'focus' && (
            <FocusView
              {...focusTimer}
              selectedTaskId={focusTaskId}
              todos={todos}
              onChangeMode={focusTimer.changeMode}
              onChangeTask={updateFocusTask}
              onCompleteTask={id => {
                toggleTodo(id)
                updateFocusTask('')
              }}
              onPause={focusTimer.pause}
              onReset={focusTimer.reset}
              onStart={focusTimer.start}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              authConfigured={auth.status !== 'unconfigured'}
              authStatus={auth.status}
              email={authUser?.email}
              settings={settings}
              syncState={syncState}
              onLogin={() => setAuthModalOpen(true)}
              onLogout={() => void logout()}
              onExport={() => void exportBackup()}
              onImport={(file, strategy) => void importBackup(file, strategy)}
              onReset={resetSettings}
              onUpdate={updateSettings}
            />
          )}
        </Suspense>
      </div>

      <Suspense fallback={null}>
        {backendConfig.isConfigured && <CloudBridge onChange={updateCloudState} />}
        {commandPaletteOpen && (
          <CommandPalette
            currentView={view}
            onAddShortcut={() => {
              setCommandPaletteOpen(false)
              setView('home')
              window.setTimeout(() => openShortcutEditor(), 0)
            }}
            onClose={() => setCommandPaletteOpen(false)}
            onExportBackup={() => void exportBackup()}
            onFocusSearch={focusSearch}
            onNavigate={setView}
            onNewNote={createNoteFromCommand}
            onToggleTheme={toggleTheme}
          />
        )}
        {shortcutEditorOpen && (
          <ShortcutEditorModal
            shortcut={editingShortcut}
            onClose={closeShortcutEditor}
            onSave={saveShortcut}
          />
        )}
        {authModalOpen && <AuthModal isDark={resolvedTheme === 'dark'} onClose={() => setAuthModalOpen(false)} />}
      </Suspense>
      <ToastViewport />
    </div>
  )
}
