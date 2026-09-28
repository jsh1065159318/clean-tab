import { useWorkspaceStore } from 'features/store/workspaceStore'
import type { Note, Shortcut, Todo } from 'features/store/workspaceStore'
import { normalizeNotes, normalizeShortcuts, normalizeTodos } from 'features/store/workspaceStorage'
import { createId } from 'utils/createId'

const CHANNEL_NAME = 'clean-tab-workspace-v1'

type Resource = 'todos' | 'notes' | 'shortcuts'

interface WorkspaceMessage {
  source: string
  resource: Resource
  value: unknown
}

const isResource = (value: unknown): value is Resource => (
  value === 'todos' || value === 'notes' || value === 'shortcuts'
)

const parseMessage = (value: unknown): WorkspaceMessage | null => {
  if (!value || typeof value !== 'object') return null
  const message = value as Partial<WorkspaceMessage>
  if (typeof message.source !== 'string' || !isResource(message.resource)) return null
  return {
    source: message.source,
    resource: message.resource,
    value: message.value,
  }
}

const normalizeResource = (resource: Resource, value: unknown): Todo[] | Note[] | Shortcut[] | null => {
  if (resource === 'todos') return normalizeTodos(value)
  if (resource === 'notes') return normalizeNotes(value)
  return normalizeShortcuts(value)
}

export type WorkspaceRemoteChange = (resource: Resource) => void

/**
 * Mirrors local workspace changes to other open new-tab pages. BroadcastChannel
 * is optional so private browsing and older embedded browsers simply continue
 * using the existing local/cloud persistence paths.
 */
export const startWorkspaceBroadcast = (onRemoteChange?: WorkspaceRemoteChange): (() => void) => {
  if (typeof globalThis.BroadcastChannel !== 'function') return () => undefined

  const channel = new globalThis.BroadcastChannel(CHANNEL_NAME)
  const source = createId()
  let previous = useWorkspaceStore.getState()

  const unsubscribe = useWorkspaceStore.subscribe(state => {
    if (state.todoLocalEpoch !== previous.todoLocalEpoch) {
      channel.postMessage({ source, resource: 'todos', value: state.todos } satisfies WorkspaceMessage)
    }
    if (state.notesLocalEpoch !== previous.notesLocalEpoch) {
      channel.postMessage({ source, resource: 'notes', value: state.notes } satisfies WorkspaceMessage)
    }
    if (state.shortcutLocalEpoch !== previous.shortcutLocalEpoch) {
      channel.postMessage({ source, resource: 'shortcuts', value: state.shortcuts } satisfies WorkspaceMessage)
    }
    previous = state
  })

  const handleMessage = (event: MessageEvent<unknown>) => {
    const message = parseMessage(event.data)
    if (!message || message.source === source) return
    const normalized = normalizeResource(message.resource, message.value)
    if (!normalized) return

    if (message.resource === 'todos') useWorkspaceStore.getState().replaceTodosFromSync(normalized as Todo[])
    if (message.resource === 'notes') useWorkspaceStore.getState().replaceNotesFromSync(normalized as Note[])
    if (message.resource === 'shortcuts') useWorkspaceStore.getState().replaceShortcutsFromSync(normalized as Shortcut[])
    onRemoteChange?.(message.resource)
  }

  channel.addEventListener('message', handleMessage)
  return () => {
    unsubscribe()
    channel.removeEventListener('message', handleMessage)
    channel.close()
  }
}
