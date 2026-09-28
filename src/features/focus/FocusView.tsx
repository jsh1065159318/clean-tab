import { MdCheckCircleOutline, MdPause, MdPlayArrow, MdReplay } from 'react-icons/md'
import type { Todo } from 'features/store/workspaceStore'
import type { FocusMode } from './useFocusTimer'
import { formatFocusTime } from './useFocusTimer'

interface FocusViewProps {
  durationSeconds: number
  isRunning: boolean
  mode: FocusMode
  progress: number
  remainingSeconds: number
  selectedTaskId: string
  todos: Todo[]
  onChangeMode: (mode: FocusMode) => void
  onChangeTask: (id: string) => void
  onCompleteTask: (id: string) => void
  onPause: () => void
  onReset: () => void
  onStart: () => void
}

const modes: Array<{ id: FocusMode; label: string }> = [
  { id: 'focus', label: '专注 25 分钟' },
  { id: 'short-break', label: '短休息 5 分钟' },
  { id: 'long-break', label: '长休息 15 分钟' },
]

export function FocusView(props: FocusViewProps) {
  const pendingTodos = props.todos.filter(todo => !todo.done)
  const selectedTodo = pendingTodos.find(todo => todo.id === props.selectedTaskId)
  const progress = Math.max(0, Math.min(1, props.progress))

  return (
    <main className="page-view focus-page">
      <div className="page-heading focus-page-heading">
        <div>
          <p className="section-kicker">深度工作</p>
          <h1>专注</h1>
          <p>{props.isRunning ? '计时进行中' : '准备开始'}</p>
        </div>
      </div>

      <section className="focus-workspace" aria-label="专注计时器">
        <div className="segmented-control focus-mode-control" aria-label="计时模式">
          {modes.map(mode => (
            <button
              className={props.mode === mode.id ? 'is-active' : ''}
              key={mode.id}
              type="button"
              onClick={() => props.onChangeMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="focus-timer" style={{ '--focus-progress': `${progress * 100}%` } as React.CSSProperties}>
          <time aria-live="polite" aria-label={`剩余 ${formatFocusTime(props.remainingSeconds)}`}>
            {formatFocusTime(props.remainingSeconds)}
          </time>
          <span>{Math.round(props.durationSeconds / 60)} 分钟</span>
        </div>

        <div className="focus-actions">
          <button className="focus-primary-action" type="button" onClick={props.isRunning ? props.onPause : props.onStart} title={props.isRunning ? '暂停' : '开始'} aria-label={props.isRunning ? '暂停计时' : '开始计时'}>
            {props.isRunning ? <MdPause /> : <MdPlayArrow />}
          </button>
          <button className="icon-button" type="button" onClick={props.onReset} title="重置" aria-label="重置计时">
            <MdReplay />
          </button>
        </div>

        <div className="focus-task-control">
          <label>
            当前任务
            <select value={props.selectedTaskId} onChange={event => props.onChangeTask(event.target.value)}>
              <option value="">不关联任务</option>
              {pendingTodos.map(todo => <option key={todo.id} value={todo.id}>{todo.text}</option>)}
            </select>
          </label>
          {selectedTodo && (
            <button className="secondary-button" type="button" onClick={() => props.onCompleteTask(selectedTodo.id)}>
              <MdCheckCircleOutline /> 完成任务
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
