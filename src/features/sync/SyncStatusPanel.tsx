import { useCallback, useEffect, useState } from 'react'
import { MdCloudOff, MdErrorOutline, MdSync } from 'react-icons/md'
import { useToastStore } from 'features/toast/toastStore'
import { useWorkspaceStore } from 'features/store/workspaceStore'
import type { Note, Todo } from 'features/store/workspaceStore'
import { workspaceRepository } from 'repositories/workspaceRepository'
import { stripConflictCopyContent, stripConflictCopySuffix } from 'utils/conflictCopy'
import { formatRelativeTime } from 'utils/formatRelativeTime'
import { useSyncDiagnostics } from './syncDiagnosticsStore'
import { syncLabels } from './syncState'
import type { SyncState } from './syncState'

const resourceLabels: Record<string, string> = {
  todos: '任务',
  note: '笔记',
  settings: '设置',
  shortcuts: '快捷方式',
}

interface ConflictItemBase {
  key: string
  resourceLabel: string
  copyPreview: string
  remotePreview: string
}

type ConflictItem =
  | (ConflictItemBase & { resource: 'todos'; copy: Todo; original: Todo | null })
  | (ConflictItemBase & { resource: 'notes'; copy: Note; original: Note | null })

interface ConflictEntry<T> {
  copy: T
  original: T | null
}

// 仓储层是 .js 文件，返回值类型需在此显式声明。
interface WorkspaceConflicts {
  todos: Array<ConflictEntry<Todo>>
  notes: Array<ConflictEntry<Note>>
}

interface SyncStatusPanelProps {
  syncState: SyncState
  signedIn: boolean
  userId: string
  onRetry: () => Promise<void>
  onLogin: () => void
  onOpenSettings: () => void
}

export function SyncStatusPanel({
  syncState,
  signedIn,
  userId,
  onRetry,
  onLogin,
  onOpenSettings,
}: SyncStatusPanelProps) {
  const pendingCount = useSyncDiagnostics(state => state.pendingCount)
  const pendingResources = useSyncDiagnostics(state => state.pendingResources)
  const attempts = useSyncDiagnostics(state => state.attempts)
  const lastSyncedAt = useSyncDiagnostics(state => state.lastSyncedAt)
  const lastError = useSyncDiagnostics(state => state.lastError)
  const showToast = useToastStore(state => state.showToast)

  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const reloadConflicts = useCallback(async () => {
    if (!signedIn) {
      setConflicts([])
      return
    }
    try {
      const result = (await workspaceRepository.listConflicts(userId)) as WorkspaceConflicts
      setConflicts([
        ...result.todos.map(entry => ({
          key: `todos:${entry.copy.id}`,
          resource: 'todos' as const,
          resourceLabel: '任务',
          copy: entry.copy,
          original: entry.original,
          copyPreview: stripConflictCopySuffix(entry.copy.text),
          remotePreview: entry.original ? entry.original.text : '原条目已删除',
        })),
        ...result.notes.map(entry => ({
          key: `notes:${entry.copy.id}`,
          resource: 'notes' as const,
          resourceLabel: '笔记',
          copy: entry.copy,
          original: entry.original,
          copyPreview: stripConflictCopySuffix(entry.copy.title),
          remotePreview: entry.original ? entry.original.title : '原条目已删除',
        })),
      ])
    } catch (error) {
      console.error('读取冲突列表失败：', error)
    }
  }, [signedIn, userId])

  useEffect(() => {
    void reloadConflicts()
  }, [reloadConflicts])

  const retry = async () => {
    setRetrying(true)
    try {
      await onRetry()
      await reloadConflicts()
    } finally {
      setRetrying(false)
    }
  }

  const resolve = async (item: ConflictItem, choice: 'local' | 'remote') => {
    setBusyKey(item.key)
    try {
      // 「采用本地版本」：把副本内容以原条目当前版本为基准写回。
      // 原条目已不存在时无法写回，只能丢弃副本。
      if (choice === 'local' && item.original) {
        if (item.resource === 'todos') {
          const [updated] = await workspaceRepository.upsertTodos(userId, [{
            ...item.original,
            text: item.copyPreview,
            done: item.copy.done,
            priority: item.copy.priority,
            tag: item.copy.tag,
            subtasks: item.copy.subtasks,
            dueDate: item.copy.dueDate,
          }])
          const current = useWorkspaceStore.getState().todos
          useWorkspaceStore.getState().replaceTodosFromSync(
            current.map(todo => (todo.id === updated.id ? updated : todo)),
          )
        } else {
          const [updated] = await workspaceRepository.upsertNotes(userId, [{
            ...item.original,
            title: item.copyPreview,
            content: stripConflictCopyContent(item.copy.content),
          }])
          const current = useWorkspaceStore.getState().notes
          useWorkspaceStore.getState().replaceNotesFromSync(
            current.map(note => (note.id === updated.id ? updated : note)),
          )
        }
      }

      // 无论保留哪一版，副本本身都不再需要。
      if (item.resource === 'todos') {
        await workspaceRepository.softDeleteTodos(userId, [{ id: item.copy.id, version: item.copy.version }])
      } else {
        await workspaceRepository.deleteNotes(userId, [{ id: item.copy.id, version: item.copy.version }])
      }

      showToast(choice === 'local' ? '已采用本地版本' : '已采用云端版本')
      await reloadConflicts()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '处理冲突失败，请稍后重试', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const lastSyncedText = formatRelativeTime(lastSyncedAt)
  const pendingText = pendingCount === 0
    ? '全部已同步'
    : `${pendingCount} 项（${pendingResources.map(item => resourceLabels[item] ?? item).join('、')}）`

  return (
    <div className="sync-panel" role="dialog" aria-label="同步状态">
      <div className="sync-panel-head">
        <strong>{syncLabels[syncState]}</strong>
        {signedIn && (
          <button className="sync-panel-action" type="button" disabled={retrying} onClick={() => void retry()}>
            <MdSync aria-hidden="true" />
            {retrying ? '重试中…' : '立即重试'}
          </button>
        )}
      </div>

      {signedIn ? (
        <dl className="sync-panel-facts">
          <div>
            <dt>待上传</dt>
            <dd>{pendingText}</dd>
          </div>
          <div>
            <dt>上次同步</dt>
            <dd>{lastSyncedText ?? '本次会话尚未成功同步'}</dd>
          </div>
          {attempts > 0 && (
            <div>
              <dt>重试</dt>
              <dd>已尝试 {attempts} 次</dd>
            </div>
          )}
          {lastError && (
            <div className="is-error">
              <dt>最近错误</dt>
              <dd>{lastError}</dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="sync-panel-hint">
          <MdCloudOff aria-hidden="true" />
          <p>未登录时全部功能在本地可用。登录后可在多设备之间同步。</p>
          <button className="sync-panel-primary" type="button" onClick={onLogin}>登录并同步</button>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="sync-panel-conflicts">
          <p className="sync-panel-section-title">
            <MdErrorOutline aria-hidden="true" />
            待处理冲突（{conflicts.length}）
          </p>
          <p className="sync-panel-section-note">
            多设备同时修改同一条目时，本地版本会被另存为副本。请选择保留哪一版。
          </p>
          {conflicts.map(item => (
            <div className="conflict-card" key={item.key}>
              <p className="conflict-card-title">
                <span className="conflict-card-tag">{item.resourceLabel}</span>
                {item.copyPreview || '（无标题）'}
              </p>
              <div className="conflict-card-compare">
                <div>
                  <span>本地版本</span>
                  <p>{item.copyPreview || '（空）'}</p>
                </div>
                <div>
                  <span>云端版本</span>
                  <p>{item.remotePreview || '（空）'}</p>
                </div>
              </div>
              <div className="conflict-card-actions">
                <button
                  type="button"
                  disabled={busyKey === item.key || !item.original}
                  title={item.original ? undefined : '原条目已被删除，只能丢弃副本'}
                  onClick={() => void resolve(item, 'local')}
                >
                  采用本地
                </button>
                <button type="button" disabled={busyKey === item.key} onClick={() => void resolve(item, 'remote')}>
                  采用云端
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="sync-panel-link" type="button" onClick={onOpenSettings}>打开设置</button>
    </div>
  )
}
