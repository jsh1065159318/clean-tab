import { describe, expect, it } from 'vitest'
import { normalizeNotes, normalizeShortcuts, normalizeTodos } from './workspaceStorage'

describe('workspace storage normalization', () => {
  it('rejects values that are not collections', () => {
    expect(normalizeTodos({})).toBeNull()
    expect(normalizeNotes('broken')).toBeNull()
    expect(normalizeShortcuts(null)).toBeNull()
  })

  it('fills missing todo fields without trusting invalid values', () => {
    const todos = normalizeTodos([{ id: 'todo-1', text: 'Ship it', done: 'yes', priority: 'urgent', dueDate: '2026-08-20' }])
    expect(todos).toEqual([expect.objectContaining({
      id: 'todo-1',
      text: 'Ship it',
      done: false,
      priority: 'medium',
      tag: '',
      subtasks: [],
      dueDate: '2026-08-20',
    })])
  })

  it('keeps usable notes and shortcuts while dropping malformed records', () => {
    expect(normalizeNotes([{ id: 'note-1' }, null])?.[0]).toEqual(expect.objectContaining({
      id: 'note-1',
      title: '未命名笔记',
      content: '',
    }))
    expect(normalizeShortcuts([
      { id: 'shortcut-1', name: 'Docs', url: 'https://example.com' },
      { name: 'Missing URL' },
    ])).toEqual([expect.objectContaining({ id: 'shortcut-1', emoji: '🔗', color: '#6366f1' })])
  })
})
