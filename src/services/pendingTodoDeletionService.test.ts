import { afterEach, describe, expect, it } from 'vitest'
import { pendingTodoDeletionService } from './pendingTodoDeletionService'

afterEach(() => {
  pendingTodoDeletionService.clear('user-a', ['todo-1', 'todo-2'])
  pendingTodoDeletionService.clear('user-b', ['todo-1'])
})

describe('pending todo deletion service', () => {
  it('protects a deleted todo until the cloud queue confirms it', () => {
    pendingTodoDeletionService.mark('user-a', 'todo-1', 3)
    expect(pendingTodoDeletionService.list('user-a')).toEqual([
      expect.objectContaining({ userId: 'user-a', id: 'todo-1', version: 3 }),
    ])
    expect(pendingTodoDeletionService.list('user-b')).toEqual([])
  })

  it('clears only the confirmed ids for the current user', () => {
    pendingTodoDeletionService.mark('user-a', 'todo-1')
    pendingTodoDeletionService.mark('user-a', 'todo-2')
    pendingTodoDeletionService.mark('user-b', 'todo-1')
    pendingTodoDeletionService.clear('user-a', ['todo-1'])
    expect(pendingTodoDeletionService.list('user-a').map(item => item.id)).toEqual(['todo-2'])
    expect(pendingTodoDeletionService.list('user-b').map(item => item.id)).toEqual(['todo-1'])
  })
})
