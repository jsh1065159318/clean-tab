import { supabaseConfig } from 'config/supabase';
import { requireSupabase } from 'services/supabaseClient';

const ensureConfigured = () => {
  if (!supabaseConfig.isConfigured) {
    throw new Error('Supabase 尚未配置。');
  }
  return requireSupabase();
};

const isUuid = value =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const throwIfError = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const isMissingConflictColumn = error =>
  error?.code === '42703' || /conflict_of/i.test(error?.message || '');

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

export const workspaceRepository = {
  async getSettings(userId) {
    const client = ensureConfigured();
    const result = await client.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
    return throwIfError(result);
  },

  async updateSettings(userId, values) {
    const client = ensureConfigured();
    const { version, ...settings } = values;
    const result = Number.isInteger(version)
      ? await client
        .from('user_settings')
        .update(settings)
        .eq('user_id', userId)
        .eq('version', version)
        .select()
        .maybeSingle()
      : await client
        .from('user_settings')
        .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' })
        .select()
        .single();
    const row = throwIfError(result);
    if (!row) {
      const remoteResult = await client
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      throw new WorkspaceConflictError('设置', values, throwIfError(remoteResult));
    }
    return row;
  },

  async listTodos(userId) {
    const client = ensureConfigured();
    const result = await client
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    return throwIfError(result).map(toTodo);
  },

  async upsertTodos(userId, todos) {
    const client = ensureConfigured();
    const saved = [];
    for (const todo of todos) {
      const values = {
        user_id: userId,
        text: todo.text,
        done: todo.done,
        priority: todo.priority,
        tag: todo.tag,
        subtasks: todo.subtasks || [],
        due_at: todo.dueDate || null,
      };
      const hasVersion = Number.isInteger(todo.version);
      const result = hasVersion && isUuid(todo.id)
        ? await client
          .from('todos')
          .update(values)
          .eq('id', todo.id)
          .eq('user_id', userId)
          .eq('version', todo.version)
          .is('deleted_at', null)
          .select()
          .maybeSingle()
        : await client
          .from('todos')
          .upsert({ ...(isUuid(todo.id) ? { id: todo.id } : {}), ...values }, { onConflict: 'id' })
          .select()
          .single();
      const row = throwIfError(result);
      if (!row) {
        const remoteResult = await client
          .from('todos')
          .select('*')
          .eq('id', todo.id)
          .eq('user_id', userId)
          .maybeSingle();
        const remote = throwIfError(remoteResult);
        throw new WorkspaceConflictError('Todo', todo, remote ? toTodo(remote) : null);
      }
      saved.push(toTodo(row));
    }
    return saved;
  },

  async softDeleteTodos(userId, deletions) {
    const client = ensureConfigured();
    for (const deletion of deletions) {
      const item = typeof deletion === 'string' ? { id: deletion } : deletion;
      let query = client
        .from('todos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', item.id)
        .is('deleted_at', null);
      if (Number.isInteger(item.version)) query = query.eq('version', item.version);
      const result = await query.select('id').maybeSingle();
      const row = throwIfError(result);
      if (!row && Number.isInteger(item.version)) {
        const remoteResult = await client
          .from('todos')
          .select('*')
          .eq('id', item.id)
          .eq('user_id', userId)
          .maybeSingle();
        const remote = throwIfError(remoteResult);
        if (remote && remote.deleted_at === null) {
          throw new WorkspaceConflictError('Todo', item, toTodo(remote));
        }
      }
    }
  },

  async listNotes(userId) {
    const client = ensureConfigured();
    let result = await client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('conflict_of', null)
      .order('updated_at', { ascending: false });
    if (isMissingConflictColumn(result.error)) {
      result = await client
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    }
    return throwIfError(result).map(toNote);
  },

  async upsertNote(userId, note) {
    const client = ensureConfigured();
    const values = {
      user_id: userId,
      title: note.title || '未命名笔记',
      content: note.content || '',
    };
    let result = Number.isInteger(note.version) && isUuid(note.id)
      ? await client
        .from('notes')
        .update(values)
        .eq('id', note.id)
        .eq('user_id', userId)
        .eq('version', note.version)
        .is('conflict_of', null)
        .select()
        .maybeSingle()
      : await client
        .from('notes')
        .upsert({ ...(isUuid(note.id) ? { id: note.id } : {}), ...values }, { onConflict: 'id' })
        .select()
        .single();
    if (isMissingConflictColumn(result.error)) {
      result = await client
        .from('notes')
        .update(values)
        .eq('id', note.id)
        .eq('user_id', userId)
        .eq('version', note.version)
        .select()
        .maybeSingle();
    }
    const row = throwIfError(result);
    if (!row) {
      const remoteResult = await client
        .from('notes')
        .select('*')
        .eq('id', note.id)
        .eq('user_id', userId)
        .maybeSingle();
      const remote = throwIfError(remoteResult);
      throw new WorkspaceConflictError('Note', note, remote ? toNote(remote) : null);
    }
    return toNote(row);
  },

  async upsertNotes(userId, notes) {
    const saved = [];
    for (const note of notes) saved.push(await this.upsertNote(userId, note));
    return saved;
  },

  async deleteNotes(userId, deletions) {
    const client = ensureConfigured();
    for (const deletion of deletions) {
      const item = typeof deletion === 'string' ? { id: deletion } : deletion;
      let query = client
        .from('notes')
        .delete()
        .eq('user_id', userId)
        .eq('id', item.id);
      if (Number.isInteger(item.version)) query = query.eq('version', item.version);
      const result = await query.select('id').maybeSingle();
      const row = throwIfError(result);
      if (!row && Number.isInteger(item.version)) {
        const remoteResult = await client
          .from('notes')
          .select('*')
          .eq('id', item.id)
          .eq('user_id', userId)
          .maybeSingle();
        const remote = throwIfError(remoteResult);
        if (remote) throw new WorkspaceConflictError('Note', item, toNote(remote));
      }
    }
  },

  async createTodoConflict(userId, todo) {
    const client = ensureConfigured();
    const result = await client
      .from('todos')
      .insert({
        user_id: userId,
        text: `${todo.text}（冲突副本）`.slice(0, 500),
        done: todo.done,
        priority: todo.priority,
        tag: todo.tag,
        subtasks: todo.subtasks || [],
        due_at: todo.dueDate || null,
      })
      .select()
      .single();
    return toTodo(throwIfError(result));
  },

  async createNoteConflict(userId, note) {
    const client = ensureConfigured();
    const result = await client
      .from('notes')
      .insert({
        user_id: userId,
        title: `${note.title || '未命名笔记'}（冲突副本）`.slice(0, 120),
        content: `本地冲突副本，编辑时间：${note.updatedAt || '未知'}\n\n${note.content || ''}`,
        conflict_of: isUuid(note.id) ? note.id : null,
      })
      .select()
      .single();
    return toNote(throwIfError(result));
  },

  async listBookmarks(userId) {
    const client = ensureConfigured();
    const result = await client.from('bookmarks').select('*').eq('user_id', userId).order('sort_order').order('created_at');
    return throwIfError(result).map(toBookmark);
  },

  async upsertBookmarks(userId, bookmarks) {
    const client = ensureConfigured();
    return Promise.all(bookmarks.map(async (bookmark, index) => {
      const values = {
        user_id: userId,
        title: bookmark.name,
        url: bookmark.url,
        emoji: bookmark.emoji,
        color: bookmark.color,
        sort_order: index,
      };
      const result = Number.isInteger(bookmark.version) && isUuid(bookmark.id)
        ? await client
          .from('bookmarks')
          .update(values)
          .eq('id', bookmark.id)
          .eq('user_id', userId)
          .eq('version', bookmark.version)
          .select()
          .maybeSingle()
        : await client
          .from('bookmarks')
          .upsert({ ...(isUuid(bookmark.id) ? { id: bookmark.id } : {}), ...values }, { onConflict: 'id' })
          .select()
          .single();
      const row = throwIfError(result);
      if (!row) {
        const remoteResult = await client
          .from('bookmarks')
          .select('*')
          .eq('id', bookmark.id)
          .eq('user_id', userId)
          .maybeSingle();
        const remote = throwIfError(remoteResult);
        throw new WorkspaceConflictError('快捷方式', bookmark, remote ? toBookmark(remote) : null);
      }
      return toBookmark(row);
    }));
  },

  async deleteBookmarks(userId, deletions) {
    const client = ensureConfigured();
    for (const deletion of deletions) {
      let query = client
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('id', deletion.id);
      if (Number.isInteger(deletion.version)) query = query.eq('version', deletion.version);
      const result = await query.select('id').maybeSingle();
      const row = throwIfError(result);
      if (!row && Number.isInteger(deletion.version)) {
        const remoteResult = await client
          .from('bookmarks')
          .select('*')
          .eq('id', deletion.id)
          .eq('user_id', userId)
          .maybeSingle();
        const remote = throwIfError(remoteResult);
        if (remote) throw new WorkspaceConflictError('快捷方式', deletion, toBookmark(remote));
      }
    }
  },
};
