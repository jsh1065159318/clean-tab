import { describe, expect, it } from 'vitest'
import { noteBodyStorage } from './noteBodyStorage'

describe('note body storage fallback', () => {
  it('does not require IndexedDB in non-browser test environments', async () => {
    expect(noteBodyStorage.isAvailable()).toBe(false)
    await expect(noteBodyStorage.writeMany([{ id: 'note-1', title: 'Test', content: 'Body' }])).resolves.toBeUndefined()
    await expect(noteBodyStorage.removeMany(['note-1'])).resolves.toBeUndefined()
  })
})
