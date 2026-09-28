import { describe, expect, it } from 'vitest'
import { compressImageFile } from './imageCompression'

describe('compressImageFile', () => {
  it('rejects non-image files before touching browser APIs', async () => {
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' })
    await expect(compressImageFile(file)).rejects.toThrow('请选择')
  })
})
