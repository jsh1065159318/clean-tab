import { describe, expect, it } from 'vitest'
import { stripConflictCopyContent, stripConflictCopySuffix } from './conflictCopy'

describe('stripConflictCopySuffix', () => {
  it('去掉末尾的冲突副本后缀', () => {
    expect(stripConflictCopySuffix('买牛奶（冲突副本）')).toBe('买牛奶')
  })

  it('没有后缀时原样返回', () => {
    expect(stripConflictCopySuffix('买牛奶')).toBe('买牛奶')
    expect(stripConflictCopySuffix('')).toBe('')
  })

  it('只去掉末尾一处，正文中间的同名文本保持不变', () => {
    expect(stripConflictCopySuffix('（冲突副本）说明（冲突副本）')).toBe('（冲突副本）说明')
  })
})

describe('stripConflictCopyContent', () => {
  it('去掉表头，保留正文', () => {
    const content = '本地冲突副本，编辑时间：2026-09-28T00:00:00.000Z\n\n正文第一行\n正文第二行'
    expect(stripConflictCopyContent(content)).toBe('正文第一行\n正文第二行')
  })

  it('编辑时间未知时同样能去掉表头', () => {
    expect(stripConflictCopyContent('本地冲突副本，编辑时间：未知\n\n正文')).toBe('正文')
  })

  it('没有表头时原样返回', () => {
    expect(stripConflictCopyContent('普通正文')).toBe('普通正文')
    expect(stripConflictCopyContent('')).toBe('')
  })

  it('表头之后为空时返回空串', () => {
    expect(stripConflictCopyContent('本地冲突副本，编辑时间：未知\n\n')).toBe('')
  })
})
