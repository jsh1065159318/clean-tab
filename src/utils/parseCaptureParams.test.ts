import { describe, expect, it } from 'vitest'
import { parseCaptureParams } from './parseCaptureParams'

describe('parseCaptureParams', () => {
  it('accepts a captured http page and limits the title', () => {
    const result = parseCaptureParams(`?capture=task&url=${encodeURIComponent('https://example.com/docs')}&title=${'x'.repeat(300)}`)
    expect(result).toEqual({ mode: 'task', url: 'https://example.com/docs', title: 'x'.repeat(200) })
  })

  it('rejects unsupported modes and protocols', () => {
    expect(parseCaptureParams('?capture=note&url=https%3A%2F%2Fexample.com')).toBeNull()
    expect(parseCaptureParams('?capture=task&url=javascript%3Aalert(1)')).toBeNull()
  })
})
