import type { Todo } from 'features/store/workspaceStore'

export type TaskSortMode = 'custom' | 'due' | 'priority'

export const sortTodos = (todos: Todo[], mode: TaskSortMode): Todo[] => {
  if (mode === 'custom') return todos
  const priorityRank = { high: 0, medium: 1, low: 2 }
  return [...todos].sort((left, right) => {
    if (mode === 'priority') return priorityRank[left.priority] - priorityRank[right.priority]
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY
    return leftDue - rightDue
  })
}
