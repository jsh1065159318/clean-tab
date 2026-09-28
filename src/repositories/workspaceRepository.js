import { ApiError, apiRequest } from 'services/apiClient';

// 说明：所有方法保留 userId 形参，以维持既有调用契约（同步服务与轮询服务按位置传参）。
// 自建后端从会话令牌推导身份，不信任客户端传入的用户标识，因此该参数不参与请求，
// 统一以下划线前缀命名。后续如需清理，可连同调用方一起移除。

const isUuid = value =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export class WorkspaceConflictError extends Error {
  constructor(resource, local, remote) {
    super(`${resource} 数据已在其他设备更新。`);
    this.name = 'WorkspaceConflictError';
    this.resource = resource;
    this.local = local;
    this.remote = remote;
  }
}

const toTodo = row => ({
  id: row.id,
  text: row.text,
  done: row.done,
  priority: row.priority,
  tag: row.tag,
  subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
  dueDate: row.due_at || undefined,
  conflictOf: row.conflict_of || undefined,
  updatedAt: row.updated_at,
  version: row.version,
});

const toNote = row => ({
  id: row.id,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  version: row.version,
});

const toBookmark = row => ({
  id: row.id,
  name: row.title,
  url: row.url,
  emoji: row.emoji,
  color: row.color,
  updatedAt: row.updated_at,
  version: row.version,
});

// 批量接口会返回 conflictId，据此把远端内容与「发生冲突的那一条本地记录」配对，
// 而不是把整批请求都当作冲突处理。
const toConflictError = ({ resource, localItems, error, mapRemote }) => {
  if (!(error instanceof ApiError) || error.status !== 409) return error;

  const conflictId = error.payload?.conflictId ?? null;
  const local = Array.isArray(localItems)
    ? localItems.find(item => item.id === conflictId) ?? localItems[0] ?? null
    : localItems;

  const remoteRow = error.payload?.remote ?? null;
  return new WorkspaceConflictError(resource, local, remoteRow ? mapRemote(remoteRow) : null);
};

export const workspaceRepository = {
  async getSettings(_userId) {
    return apiRequest('/workspace/settings');
  },

  async updateSettings(_userId, values) {
    try {
      return await apiRequest('/workspace/settings', { method: 'PUT', body: values });
    } catch (error) {
      throw toConflictError({ resource: '设置', localItems: values, error, mapRemote: row => row });
    }
  },

  async listTodos(_userId) {
    const rows = await apiRequest('/workspace/todos');
    return rows.map(toTodo);
  },

  async upsertTodos(_userId, todos) {
    try {
      const rows = await apiRequest('/workspace/todos/upsert', { method: 'POST', body: { items: todos } });
      return rows.map(toTodo);
    } catch (error) {
      throw toConflictError({ resource: 'Todo', localItems: todos, error, mapRemote: toTodo });
    }
  },

  async softDeleteTodos(_userId, deletions) {
    const items = deletions.map(deletion => (typeof deletion === 'string' ? { id: deletion } : deletion));
    try {
      await apiRequest('/workspace/todos/delete', { method: 'POST', body: { items } });
    } catch (error) {
      throw toConflictError({ resource: 'Todo', localItems: items, error, mapRemote: toTodo });
    }
  },

  async createTodoConflict(_userId, todo) {
    const row = await apiRequest('/workspace/todos/conflict', { method: 'POST', body: { item: todo } });
    return toTodo(row);
  },

  async listNotes(_userId) {
    const rows = await apiRequest('/workspace/notes');
    return rows.map(toNote);
  },

  async upsertNote(_userId, note) {
    const [saved] = await this.upsertNotes(_userId, [note]);
    return saved;
  },

  async upsertNotes(_userId, notes) {
    try {
      const rows = await apiRequest('/workspace/notes/upsert', { method: 'POST', body: { items: notes } });
      return rows.map(toNote);
    } catch (error) {
      throw toConflictError({ resource: 'Note', localItems: notes, error, mapRemote: toNote });
    }
  },

  async deleteNotes(_userId, deletions) {
    const items = deletions.map(deletion => (typeof deletion === 'string' ? { id: deletion } : deletion));
    try {
      await apiRequest('/workspace/notes/delete', { method: 'POST', body: { items } });
    } catch (error) {
      throw toConflictError({ resource: 'Note', localItems: items, error, mapRemote: toNote });
    }
  },

  async createNoteConflict(_userId, note) {
    const row = await apiRequest('/workspace/notes/conflict', {
      method: 'POST',
      body: {
        item: {
          id: isUuid(note.id) ? note.id : null,
          title: note.title,
          content: note.content,
          updatedAt: note.updatedAt,
        },
      },
    });
    return toNote(row);
  },

  async listBookmarks(_userId) {
    const rows = await apiRequest('/workspace/bookmarks');
    return rows.map(toBookmark);
  },

  async upsertBookmarks(_userId, bookmarks) {
    try {
      const rows = await apiRequest('/workspace/bookmarks/upsert', {
        method: 'POST',
        body: { items: bookmarks },
      });
      return rows.map(toBookmark);
    } catch (error) {
      throw toConflictError({ resource: '快捷方式', localItems: bookmarks, error, mapRemote: toBookmark });
    }
  },

  async deleteBookmarks(_userId, deletions) {
    const items = deletions.map(deletion => (typeof deletion === 'string' ? { id: deletion } : deletion));
    try {
      await apiRequest('/workspace/bookmarks/delete', { method: 'POST', body: { items } });
    } catch (error) {
      throw toConflictError({ resource: '快捷方式', localItems: items, error, mapRemote: toBookmark });
    }
  },

  // 冲突副本不进入常规列表，需要单独查询。
  // 每条返回副本与它覆盖的原条目；原条目可能为 null（已被删除）。
  async listConflicts(_userId) {
    const payload = await apiRequest('/workspace/conflicts');
    const todoEntries = Array.isArray(payload?.todos) ? payload.todos : [];
    const noteEntries = Array.isArray(payload?.notes) ? payload.notes : [];

    return {
      todos: todoEntries.map(entry => ({
        copy: toTodo(entry.copy),
        original: entry.original ? toTodo(entry.original) : null,
      })),
      notes: noteEntries.map(entry => ({
        copy: toNote(entry.copy),
        original: entry.original ? toNote(entry.original) : null,
      })),
    };
  },
};
