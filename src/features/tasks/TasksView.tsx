import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { MdAdd, MdDeleteOutline } from 'react-icons/md'
import type { Priority, Todo } from 'features/store/workspaceStore'
import { sortTodos } from './taskSorting'

type Filter = 'pending' | 'all' | 'done'
type SortMode = 'custom' | 'due' | 'priority'

interface TasksViewProps {
  todos: Todo[]
  onAdd: (text: string) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onUpdate: (todo: Todo) => void
}

export function TasksView({ todos, onAdd, onDelete, onToggle, onUpdate }: TasksViewProps) {
  const [filter, setFilter] = useState<Filter>('pending')
  const [sortMode, setSortMode] = useState<SortMode>('custom')
  const [draft, setDraft] = useState('')
  const visibleTodos = useMemo(() => {
    const filtered = filter === 'pending'
      ? todos.filter(todo => !todo.done)
      : filter === 'done' ? todos.filter(todo => todo.done) : todos
    return sortTodos(filtered, sortMode)
  }, [filter, sortMode, todos])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    onAdd(value)
    setDraft('')
  }

  return (
    <main className="page-view">
      <div className="page-heading">
        <div>
          <p className="section-kicker">清晰安排</p>
          <h1>任务</h1>
          <p>{todos.filter(todo => !todo.done).length} 件待完成</p>
        </div>
      </div>

      <section className="page-card tasks-card">
        <form className="task-create" onSubmit={submit}>
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="添加新任务"
            aria-label="添加新任务"
          />
          <button type="submit"><MdAdd /> 添加</button>
        </form>

        <div className="task-toolbar">
          <div className="segmented-control" aria-label="任务筛选">
            {([
              ['pending', '待完成'],
              ['all', '全部'],
              ['done', '已完成'],
            ] as const).map(([value, label]) => (
              <button
                className={filter === value ? 'is-active' : ''}
                key={value}
                type="button"
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="task-sort">
            <span>排序</span>
            <select value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)} aria-label="任务排序">
              <option value="custom">自定义</option>
              <option value="due">截止日期</option>
              <option value="priority">优先级</option>
            </select>
          </label>
        </div>

        <div className="task-list">
          {visibleTodos.length === 0 && <div className="empty-state large">这里还没有任务。</div>}
          {visibleTodos.map(todo => (
            <div className={`task-row${todo.done ? ' is-done' : ''}${todo.dueDate && !todo.done && todo.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) ? ' is-overdue' : ''}`} key={todo.id}>
              <label>
                <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} aria-label={`完成 ${todo.text}`} />
              </label>
              <div className="task-main">
                <input
                  className="task-text-input"
                  defaultValue={todo.text}
                  aria-label={`编辑任务 ${todo.text}`}
                  onBlur={event => {
                    const text = event.target.value.trim()
                    if (text && text !== todo.text) onUpdate({ ...todo, text })
                    else event.target.value = todo.text
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') {
                      event.currentTarget.value = todo.text
                      event.currentTarget.blur()
                    }
                  }}
                />
                <input
                  className="task-due-date"
                  type="date"
                  value={todo.dueDate?.slice(0, 10) || ''}
                  aria-label={`${todo.text} 的截止日期`}
                  onChange={event => onUpdate({ ...todo, dueDate: event.target.value || undefined })}
                />
              </div>
              <select
                className={`task-priority priority-${todo.priority}`}
                value={todo.priority}
                aria-label={`${todo.text} 的优先级`}
                onChange={event => onUpdate({ ...todo, priority: event.target.value as Priority })}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <button type="button" onClick={() => onDelete(todo.id)} aria-label={`删除 ${todo.text}`}>
                <MdDeleteOutline />
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
