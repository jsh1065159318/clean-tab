import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from 'features/store/workspaceStore'
import { startWorkspaceBroadcast } from './workspaceBroadcastService'

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = []
  readonly messages: unknown[] = []
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>()

  constructor(readonly name: string) {
    MockBroadcastChannel.instances.push(this)
  }

  addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
    this.listeners.delete(listener)
  }

  postMessage(message: unknown) {
    this.messages.push(message)
  }

  emit(message: unknown) {
    this.listeners.forEach(listener => listener({ data: message } as MessageEvent<unknown>))
  }

  close() {}
}

afterEach(() => {
  vi.unstubAllGlobals()
  MockBroadcastChannel.instances = []
  useWorkspaceStore.setState({
    todos: [],
    todoLocalEpoch: 0,
    todoSyncEpoch: 0,
    notes: [],
    notesLocalEpoch: 0,
    notesSyncEpoch: 0,
    shortcuts: [],
    shortcutLocalEpoch: 0,
    shortcutSyncEpoch: 0,
  })
})

describe('workspace broadcast service', () => {
  it('publishes local changes without echoing sync replacements', () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    const stop = startWorkspaceBroadcast()
    const channel = MockBroadcastChannel.instances[0]

    useWorkspaceStore.getState().setTodos([{ id: 'todo-1', text: '本地任务', done: false, priority: 'medium', tag: '', subtasks: [] }])
    expect(channel.messages).toHaveLength(1)
    expect(channel.messages[0]).toEqual(expect.objectContaining({ resource: 'todos' }))

    channel.emit({ source: 'other-tab', resource: 'todos', value: [{ id: 'todo-2', text: '另一标签页', done: false }] })
    expect(useWorkspaceStore.getState().todos[0].id).toBe('todo-2')
    expect(channel.messages).toHaveLength(1)
    stop()
  })

  it('ignores malformed messages and works when BroadcastChannel is unavailable', () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    const onRemoteChange = vi.fn()
    const stop = startWorkspaceBroadcast(onRemoteChange)
    const channel = MockBroadcastChannel.instances[0]
    channel.emit({ resource: 'todos', value: [] })
    channel.emit({ source: 'other-tab', resource: 'unknown', value: [] })
    expect(onRemoteChange).not.toHaveBeenCalled()
    stop()

    vi.stubGlobal('BroadcastChannel', undefined)
    expect(() => startWorkspaceBroadcast()).not.toThrow()
  })
})
