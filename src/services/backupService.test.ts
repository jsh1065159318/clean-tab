import { describe, expect, it } from 'vitest'
import { createBackupJson, parseBackupJson } from './backupService'

const data = {
  favoriteToolIds: ['json'],
  notes: [{ id: 'note-1', title: 'Note', content: 'Body' }],
  settings: { theme: 'dark' },
  shortcuts: [{ id: 'shortcut-1', name: 'Docs', url: 'https://example.com', emoji: 'D', color: '#000000' }],
  todos: [{ id: 'todo-1', text: 'Test', done: false, priority: 'high' as const, tag: '', subtasks: [] }],
}

describe('backup service', () => {
  it('round trips a versioned backup', () => {
    const restored = parseBackupJson(createBackupJson(data))
    expect(restored.favoriteToolIds).toEqual(data.favoriteToolIds)
    expect(restored.settings).toEqual(data.settings)
    expect(restored.todos[0]).toEqual(expect.objectContaining(data.todos[0]))
    expect(restored.notes[0]).toEqual(expect.objectContaining(data.notes[0]))
    expect(restored.shortcuts[0]).toEqual(expect.objectContaining(data.shortcuts[0]))
  })

  it('rejects foreign and incomplete backups', () => {
    expect(() => parseBackupJson('{"product":"other","version":1,"data":{}}')).toThrow(/格式或版本/)
    expect(() => parseBackupJson('{')).toThrow(/JSON/)
  })
})
