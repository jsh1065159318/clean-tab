import { afterEach, describe, expect, it } from 'vitest'
import { pendingNoteDeletionService } from './pendingNoteDeletionService'

afterEach(() => {
  pendingNoteDeletionService.clear('user-a', ['note-1', 'note-2'])
  pendingNoteDeletionService.clear('user-b', ['note-1'])
})

describe('pending note deletion service', () => {
  it('protects a deleted note until cloud deletion is confirmed', () => {
    pendingNoteDeletionService.mark('user-a', 'note-1', 4)
    expect(pendingNoteDeletionService.list('user-a')).toEqual([
      expect.objectContaining({ userId: 'user-a', id: 'note-1', version: 4 }),
    ])
    expect(pendingNoteDeletionService.list('user-b')).toEqual([])
  })

  it('clears only confirmed note ids for the current user', () => {
    pendingNoteDeletionService.mark('user-a', 'note-1')
    pendingNoteDeletionService.mark('user-a', 'note-2')
    pendingNoteDeletionService.mark('user-b', 'note-1')
    pendingNoteDeletionService.clear('user-a', ['note-1'])
    expect(pendingNoteDeletionService.list('user-a').map(item => item.id)).toEqual(['note-2'])
    expect(pendingNoteDeletionService.list('user-b').map(item => item.id)).toEqual(['note-1'])
  })
})
