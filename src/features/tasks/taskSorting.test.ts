import { describe, expect, it } from 'vitest'
import type { Todo } from 'features/store/workspaceStore'
import { sortTodos } from './taskSorting'

const todo = (id: string, priority: Todo['priority'], dueDate?: string): Todo => ({
  id,
  text: id,
  done: false,
  priority,
  tag: '',
  subtasks: [],
  dueDate,
})

describe('sortTodos', () => {
  it('keeps custom order and puts undated tasks last for due sorting', () => {
    const todos = [todo('undated', 'low'), todo('later', 'medium', '2026-08-20'), todo('soon', 'high', '2026-08-19')]
    expect(sortTodos(todos, 'custom').map(item => item.id)).toEqual(['undated', 'later', 'soon'])
    expect(sortTodos(todos, 'due').map(item => item.id)).toEqual(['soon', 'later', 'undated'])
  })

  it('sorts high priority before medium and low', () => {
    const todos = [todo('low', 'low'), todo('high', 'high'), todo('medium', 'medium')]
    expect(sortTodos(todos, 'priority').map(item => item.id)).toEqual(['high', 'medium', 'low'])
  })
})
