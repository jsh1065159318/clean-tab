import { create } from 'zustand'
import { STORAGE_KEYS } from 'constants/storageKeys'
import { storageService } from 'services/storageService'
import { resolveUpdater } from 'utils/resolveUpdater'
import { createId } from 'utils/createId'
import type { StateUpdater } from 'utils/resolveUpdater'
import { normalizeNotes, normalizeShortcuts, normalizeTodos } from './workspaceStorage'
import { noteBodyStorage } from 'services/noteBodyStorage'

export type Priority = 'high' | 'medium' | 'low'

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export interface Todo {
  id: string
  text: string
  done: boolean
  priority: Priority
  tag: string
  subtasks: Subtask[]
  dueDate?: string
  // 非空表示这一条是「冲突副本」，指向被它覆盖的原任务。
  // 副本不出现在常规任务列表，只在同步面板的冲突区呈现。
  conflictOf?: string
  updatedAt?: string
  version?: number
}

export interface Note {
  id: string
  title: string
  content: string
  createdAt?: string
  updatedAt?: string
  version?: number
}

export interface Shortcut {
  id: string
  name: string
  url: string
  emoji: string
  color: string
  updatedAt?: string
  version?: number
}

interface WorkspaceState {
  todos: Todo[]
  todoLocalEpoch: number
  todoSyncEpoch: number
  notes: Note[]
  notesLocalEpoch: number
  notesSyncEpoch: number
  shortcuts: Shortcut[]
  shortcutLocalEpoch: number
  shortcutSyncEpoch: number
  setTodos: (value: StateUpdater<Todo[]>) => void
  replaceTodosFromSync: (todos: Todo[]) => void
  setNotes: (value: StateUpdater<Note[]>) => void
  replaceNotesFromSync: (notes: Note[]) => void
  hydrateNotesFromBodyStorage: () => Promise<void>
  setShortcuts: (value: StateUpdater<Shortcut[]>) => void
  replaceShortcutsFromSync: (shortcuts: Shortcut[]) => void
}

const INITIAL_TODOS: Todo[] = []

const INITIAL_SHORTCUTS: Shortcut[] = [
  { id: 'github', name: 'GitHub', url: 'https://github.com', emoji: '⌘', color: '#24292e' },
  { id: 'mail', name: '邮箱', url: 'https://mail.google.com', emoji: '✉', color: '#ea4335' },
  { id: 'youtube', name: 'YouTube', url: 'https://youtube.com', emoji: '▶', color: '#ff0000' },
  { id: 'notion', name: 'Notion', url: 'https://notion.so', emoji: 'N', color: '#111827' },
  { id: 'figma', name: 'Figma', url: 'https://figma.com', emoji: 'F', color: '#a259ff' },
  { id: 'bilibili', name: '哔哩哔哩', url: 'https://bilibili.com', emoji: 'B', color: '#00aeec' },
]

const INITIAL_NOTE: Note = {
  id: 'local-note',
  title: '随手记',
  content: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const LEGACY_TODO_TEXTS = new Set([
  '完成产品需求文档',
  '准备下午团队会议',
  '代码审查 PR #142',
  '回复客户邮件',
  '更新项目进度报告',
  '学习 React 19 新特性',
  '整理本周工作笔记',
  '安排下周 Sprint 计划',
])

const LEGACY_SHORTCUT_NAMES = new Set([
  'Google',
  'GitHub',
  'ChatGPT',
  '邮箱',
  '企业OA',
  '云盘',
  '开发工具',
  'Linear',
])

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const readTodos = (): Todo[] => {
  const saved = storageService.getValidatedJSON(STORAGE_KEYS.todos, INITIAL_TODOS, normalizeTodos)
  const isLegacySeed = saved.length === LEGACY_TODO_TEXTS.size
    && saved.every(todo => LEGACY_TODO_TEXTS.has(todo.text))
  const stored = (isLegacySeed ? INITIAL_TODOS : saved)
    .map(todo => ({
      ...todo,
      id: isUuid(todo.id) ? todo.id : createId(),
      subtasks: todo.subtasks || [],
    }))
  storageService.setJSON(STORAGE_KEYS.todos, stored)
  return stored
}

const readNotes = (): Note[] => {
  const saved = storageService.getValidatedJSON<Note[] | null>(STORAGE_KEYS.notes, null, value => (
    value === null ? null : normalizeNotes(value)
  ))
  const legacyNote = storageService.getJSON<Note>(STORAGE_KEYS.note, INITIAL_NOTE)
  const source = saved === null ? [legacyNote] : saved
  const now = new Date().toISOString()
  const normalized = source.map(note => ({
    ...note,
    id: isUuid(note.id) ? note.id : createId(),
    title: note.title || '未命名笔记',
    content: note.content || '',
    createdAt: note.createdAt || note.updatedAt || now,
    updatedAt: note.updatedAt || now,
  }))
  storageService.setJSON(STORAGE_KEYS.notes, normalized)
  return normalized
}

const readShortcuts = (): Shortcut[] => {
  const saved = storageService.getValidatedJSON(STORAGE_KEYS.shortcuts, INITIAL_SHORTCUTS, normalizeShortcuts)
  const isLegacySeed = saved.length === LEGACY_SHORTCUT_NAMES.size
    && saved.every(shortcut => LEGACY_SHORTCUT_NAMES.has(shortcut.name))
  const stored = (isLegacySeed ? INITIAL_SHORTCUTS : saved)
    .map(shortcut => ({
      ...shortcut,
      id: isUuid(shortcut.id) ? shortcut.id : createId(),
    }))
  storageService.setJSON(STORAGE_KEYS.shortcuts, stored)
  return stored
}

const noteMetadata = (notes: Note[]) => notes.map(({ content: _content, ...note }) => note)

const persistNoteSnapshot = (notes: Note[], previousNotes: Note[] = []): void => {
  const previousIds = new Set(previousNotes.map(note => note.id))
  const nextIds = new Set(notes.map(note => note.id))
  const removedIds = [...previousIds].filter(id => !nextIds.has(id))
  if (!noteBodyStorage.isAvailable() || !noteBodyStorage.isMigrated()) {
    storageService.setJSON(STORAGE_KEYS.notes, notes)
    return
  }
  void Promise.all([
    noteBodyStorage.writeMany(notes),
    noteBodyStorage.removeMany(removedIds),
  ]).then(() => {
    storageService.setJSON(STORAGE_KEYS.notes, noteMetadata(notes))
  }).catch(() => {
    storageService.setJSON(STORAGE_KEYS.notes, notes)
  })
}

storageService.setJSON(STORAGE_KEYS.schemaVersion, 1)

export const useWorkspaceStore = create<WorkspaceState>()(set => ({
  todos: readTodos(),
  todoLocalEpoch: 0,
  todoSyncEpoch: 0,
  notes: readNotes(),
  notesLocalEpoch: 0,
  notesSyncEpoch: 0,
  shortcuts: readShortcuts(),
  shortcutLocalEpoch: 0,
  shortcutSyncEpoch: 0,

  setTodos: value =>
    set(state => {
      const todos = resolveUpdater(value, state.todos)
      storageService.setJSON(STORAGE_KEYS.todos, todos)
      return { todos, todoLocalEpoch: state.todoLocalEpoch + 1 }
    }),

  replaceTodosFromSync: todos =>
    set(state => {
      storageService.setJSON(STORAGE_KEYS.todos, todos)
      return { todos, todoSyncEpoch: (state.todoSyncEpoch || 0) + 1 }
    }),

  setNotes: value =>
    set(state => {
      const notes = resolveUpdater(value, state.notes)
      persistNoteSnapshot(notes, state.notes)
      return { notes, notesLocalEpoch: state.notesLocalEpoch + 1 }
    }),

  replaceNotesFromSync: notes => set(state => {
    persistNoteSnapshot(notes, state.notes)
    return { notes, notesSyncEpoch: state.notesSyncEpoch + 1 }
  }),

  hydrateNotesFromBodyStorage: async () => {
    if (!noteBodyStorage.isAvailable()) return
    const current = useWorkspaceStore.getState().notes
    const bodies = await noteBodyStorage.readMany(current)
    const next = current.map(note => {
      const body = bodies.get(note.id)
      if (!body) return note
      const noteTime = note.updatedAt ? new Date(note.updatedAt).getTime() : 0
      const bodyTime = body.updatedAt ? new Date(body.updatedAt).getTime() : 0
      return bodyTime >= noteTime && body.content !== note.content
        ? { ...note, content: body.content, updatedAt: body.updatedAt || note.updatedAt }
        : note
    })

    const latest = useWorkspaceStore.getState().notes
    const originalById = new Map(current.map(note => [note.id, note]))
    const hydratedById = new Map(next.map(note => [note.id, note]))
    const effective = latest.map(note => {
      const original = originalById.get(note.id)
      const hydrated = hydratedById.get(note.id)
      // Keep edits made while the asynchronous migration was in flight.
      if (original && note.content !== original.content) return note
      return hydrated || note
    })

    await noteBodyStorage.writeMany(effective)
    noteBodyStorage.markMigrated()
    storageService.setJSON(STORAGE_KEYS.notes, noteMetadata(effective))
    if (effective.some((note, index) => note.content !== latest[index]?.content)) {
      useWorkspaceStore.setState(state => ({ notes: effective, notesLocalEpoch: state.notesLocalEpoch + 1 }))
    }
  },

  setShortcuts: value =>
    set(state => {
      const shortcuts = resolveUpdater(value, state.shortcuts)
      storageService.setJSON(STORAGE_KEYS.shortcuts, shortcuts)
      return { shortcuts, shortcutLocalEpoch: state.shortcutLocalEpoch + 1 }
    }),

  replaceShortcutsFromSync: shortcuts =>
    set(state => {
      storageService.setJSON(STORAGE_KEYS.shortcuts, shortcuts)
      return { shortcuts, shortcutSyncEpoch: state.shortcutSyncEpoch + 1 }
    }),
}))
