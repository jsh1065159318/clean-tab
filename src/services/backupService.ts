import type { Note, Shortcut, Todo } from '../features/store/workspaceStore'
import { normalizeNotes, normalizeShortcuts, normalizeTodos } from '../features/store/workspaceStorage'

export const BACKUP_VERSION = 1

export interface BackupSettings {
  backgroundColor?: string
  backgroundImageUrl?: string
  backgroundMode?: string
  greetingName?: string
  searchEngine?: string
  showGreeting?: boolean
  showQuicklinks?: boolean
  theme?: string
}

export interface BackupData {
  favoriteToolIds: string[]
  notes: Note[]
  settings: BackupSettings
  shortcuts: Shortcut[]
  todos: Todo[]
}

interface BackupEnvelope {
  product: 'clean-tab'
  version: typeof BACKUP_VERSION
  exportedAt: string
  data: BackupData
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const normalizeSettings = (value: unknown): BackupSettings | null => {
  if (!isRecord(value)) return null
  const settings: BackupSettings = {}
  const stringKeys = ['backgroundColor', 'backgroundImageUrl', 'backgroundMode', 'greetingName', 'searchEngine', 'theme'] as const
  const booleanKeys = ['showGreeting', 'showQuicklinks'] as const
  stringKeys.forEach(key => {
    if (typeof value[key] === 'string') settings[key] = value[key]
  })
  booleanKeys.forEach(key => {
    if (typeof value[key] === 'boolean') settings[key] = value[key]
  })
  return settings
}

export const createBackupJson = (data: BackupData): string => JSON.stringify({
  product: 'clean-tab',
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  data,
} satisfies BackupEnvelope, null, 2)

export const parseBackupJson = (source: string): BackupData => {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error('备份文件不是有效的 JSON。')
  }
  if (!isRecord(parsed) || parsed.product !== 'clean-tab' || parsed.version !== BACKUP_VERSION || !isRecord(parsed.data)) {
    throw new Error('备份格式或版本不受支持。')
  }

  const todos = normalizeTodos(parsed.data.todos)
  const notes = normalizeNotes(parsed.data.notes)
  const shortcuts = normalizeShortcuts(parsed.data.shortcuts)
  const settings = normalizeSettings(parsed.data.settings)
  const favoriteToolIds = Array.isArray(parsed.data.favoriteToolIds)
    ? parsed.data.favoriteToolIds.filter((item): item is string => typeof item === 'string')
    : null
  if (!todos || !notes || !shortcuts || !settings || !favoriteToolIds) {
    throw new Error('备份内容不完整或已损坏。')
  }
  return { favoriteToolIds, notes, settings, shortcuts, todos }
}
