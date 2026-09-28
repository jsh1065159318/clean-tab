import { describe, expect, it } from 'vitest'
import type { Todo } from 'features/store/workspaceStore'
import { removeTodo } from './removeTodo'

const todos: Todo[] = [
  { id: 'one', text: 'One', done: false, priority: 'medium', tag: '', subtasks: [], version: 3 },
  { id: 'two', text: 'Two', done: true, priority: 'low', tag: '', subtasks: [] },
]

describe('removeTodo', () => {
  it('returns the deleted entity and remaining list for sync', () => {
    expect(removeTodo(todos, 'one')).toEqual({
      deletedTodo: todos[0],
      remainingTodos: [todos[1]],
    })
  })

  it('does not change the list when the id is unknown', () => {
    expect(removeTodo(todos, 'missing')).toBeNull()
    expect(todos).toHaveLength(2)
  })
})
