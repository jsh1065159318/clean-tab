import type { Todo } from 'features/store/workspaceStore'

export interface TodoRemoval {
  deletedTodo: Todo
  remainingTodos: Todo[]
}

export const removeTodo = (todos: Todo[], id: string): TodoRemoval | null => {
  const deletedTodo = todos.find(todo => todo.id === id)
  if (!deletedTodo) return null
  return {
    deletedTodo,
    remainingTodos: todos.filter(todo => todo.id !== id),
  }
}
