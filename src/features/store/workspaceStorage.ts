import type { Note, Priority, Shortcut, Subtask, Todo } from './workspaceStore'

const priorities = new Set<Priority>(['high', 'medium', 'low'])
const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)
const asOptionalString = (value: unknown) => typeof value === 'string' ? value : undefined

const normalizeSubtasks = (value: unknown): Subtask[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!isRecord(item) || typeof item.text !== 'string') return []
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      text: item.text,
      done: item.done === true,
    }]
  })
}

export const normalizeTodos = (value: unknown): Todo[] | null => {
  if (!Array.isArray(value)) return null
  return value.flatMap(item => {
    if (!isRecord(item) || typeof item.text !== 'string') return []
    const priority = priorities.has(item.priority as Priority) ? item.priority as Priority : 'medium'
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      text: item.text,
      done: item.done === true,
      priority,
      tag: typeof item.tag === 'string' ? item.tag : '',
      subtasks: normalizeSubtasks(item.subtasks),
      dueDate: typeof item.dueDate === 'string' ? item.dueDate : undefined,
      updatedAt: asOptionalString(item.updatedAt),
      version: typeof item.version === 'number' ? item.version : undefined,
    }]
  })
}

export const normalizeNotes = (value: unknown): Note[] | null => {
  if (!Array.isArray(value)) return null
  const now = new Date().toISOString()
  return value.flatMap(item => {
    if (!isRecord(item)) return []
    const createdAt = asOptionalString(item.createdAt) || asOptionalString(item.updatedAt) || now
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      title: typeof item.title === 'string' ? item.title : '未命名笔记',
      content: typeof item.content === 'string' ? item.content : '',
      createdAt,
      updatedAt: asOptionalString(item.updatedAt) || createdAt,
      version: typeof item.version === 'number' ? item.version : undefined,
    }]
  })
}

export const normalizeShortcuts = (value: unknown): Shortcut[] | null => {
  if (!Array.isArray(value)) return null
  return value.flatMap(item => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.url !== 'string') return []
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      name: item.name,
      url: item.url,
      emoji: typeof item.emoji === 'string' ? item.emoji : '🔗',
      color: typeof item.color === 'string' ? item.color : '#6366f1',
      updatedAt: asOptionalString(item.updatedAt),
      version: typeof item.version === 'number' ? item.version : undefined,
    }]
  })
}
