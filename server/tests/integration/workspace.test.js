import '../helpers/env.js';

import { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, createBookmark, createNote, createTodo, createUser } from '../helpers/client.js';
import { closeDatabase, withDatabase } from '../helpers/database.js';

after(closeDatabase);

// version 必须是数字：node-postgres 会把 bigint(int8) 解析成字符串，
// 而前端用 Number.isInteger(version) 判断是否携带版本号，
// 一旦退化为字符串，乐观锁会静默失效、所有更新变成无条件覆盖。
const assertNumericVersion = (row, label) => {
  assert.equal(
    typeof row.version,
    'number',
    `${label} 的 version 必须是数字，实际为 ${typeof row.version}（${JSON.stringify(row.version)}）`,
  );
};

const settingsPayload = overrides => ({
  theme: 'auto',
  greeting_name: '',
  search_engine: 'google',
  background_mode: 'gradient',
  background_color: '#111827',
  background_image_url: '',
  show_greeting: true,
  show_quicklinks: true,
  ...overrides,
});

describe('设置与乐观锁', () => {
  withDatabase('注册时自动创建设置行，version 为数字 1', async () => {
    const { token } = await createUser('settings');
    const response = await api('/workspace/settings', { token });

    assert.equal(response.status, 200);
    assert.ok(response.data, '注册后应存在设置行');
    assertNumericVersion(response.data, '设置');
    assert.equal(response.data.version, 1);
    assert.equal(response.data.theme, 'auto');
  });

  withDatabase('版本匹配时更新成功并自增', async () => {
    const { token } = await createUser('settings-update');
    const response = await api('/workspace/settings', {
      method: 'PUT',
      token,
      body: settingsPayload({ theme: 'dark', greeting_name: '小明', show_greeting: false, version: 1 }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.version, 2);
    assert.equal(response.data.theme, 'dark');
    assert.equal(response.data.greeting_name, '小明');
    assert.equal(response.data.show_greeting, false);
  });

  withDatabase('版本过期返回 409 并携带远端内容', async () => {
    const { token } = await createUser('settings-stale');

    await api('/workspace/settings', { method: 'PUT', token, body: settingsPayload({ theme: 'dark', version: 1 }) });
    const stale = await api('/workspace/settings', {
      method: 'PUT',
      token,
      body: settingsPayload({ theme: 'light', version: 1 }),
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.data.error, 'CONFLICT');
    assert.equal(stale.data.remote.version, 2);
    assert.equal(stale.data.remote.theme, 'dark', '远端内容应反映已提交的更新');
  });

  withDatabase('不带版本号时执行 upsert 并自增', async () => {
    const { token } = await createUser('settings-upsert');
    const first = await api('/workspace/settings', { method: 'PUT', token, body: settingsPayload({ theme: 'dark' }) });
    const second = await api('/workspace/settings', { method: 'PUT', token, body: settingsPayload({ theme: 'light' }) });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.data.version, first.data.version + 1);
    assert.equal(second.data.theme, 'light');
  });
});

describe('任务', () => {
  withDatabase('新增任务返回数字版本号，并保留子任务与截止时间', async () => {
    const { token } = await createUser('todo-create');
    const todo = await createTodo(token, {
      text: '写集成测试',
      priority: 'high',
      tag: '工作',
      subtasks: [{ id: 's1', text: '子项', done: false }],
      dueDate: '2026-10-01T00:00:00.000Z',
    });

    assertNumericVersion(todo, '任务');
    assert.equal(todo.version, 1);
    assert.equal(todo.text, '写集成测试');
    assert.equal(todo.priority, 'high');
    assert.deepEqual(todo.subtasks, [{ id: 's1', text: '子项', done: false }]);
    assert.equal(todo.due_at, '2026-10-01T00:00:00.000Z');
    assert.equal(todo.deleted_at, null);
  });

  withDatabase('列表只返回未软删除的任务，按更新时间倒序', async () => {
    const { token } = await createUser('todo-list');
    const first = await createTodo(token, { text: '第一条' });
    const second = await createTodo(token, { text: '第二条' });

    const listed = await api('/workspace/todos', { token });
    assert.equal(listed.status, 200);
    assert.equal(listed.data.length, 2);
    assert.equal(listed.data[0].id, second.id, '最新更新的应排在最前');
    assert.equal(listed.data[1].id, first.id);
  });

  withDatabase('版本匹配时更新成功并自增', async () => {
    const { token } = await createUser('todo-update');
    const todo = await createTodo(token, { text: '原始内容' });

    const updated = await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: {
        items: [{
          id: todo.id,
          text: '更新后内容',
          done: true,
          priority: 'low',
          tag: '',
          subtasks: [],
          version: todo.version,
        }],
      },
    });

    assert.equal(updated.status, 200);
    assertNumericVersion(updated.data[0], '任务');
    assert.equal(updated.data[0].version, 2);
    assert.equal(updated.data[0].text, '更新后内容');
    assert.equal(updated.data[0].done, true);
  });

  withDatabase('版本过期返回 409 且携带 conflictId 指向冲突条目', async () => {
    const { token } = await createUser('todo-stale');
    const todo = await createTodo(token, { text: '原始内容' });

    await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: todo.id, text: '先写入', done: false, priority: 'medium', tag: '', subtasks: [], version: todo.version }] },
    });

    const stale = await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: todo.id, text: '过期写入', done: false, priority: 'medium', tag: '', subtasks: [], version: todo.version }] },
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.data.conflictId, todo.id, '批量接口必须告知是哪一条冲突，否则客户端会把整批都当冲突');
    assert.equal(stale.data.remote.version, 2);
    assert.equal(stale.data.remote.text, '先写入');
  });

  withDatabase('批量写入中任一冲突会整批回滚', async () => {
    const { token } = await createUser('todo-atomic');
    const todo = await createTodo(token, { text: '会冲突的任务' });

    await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: todo.id, text: '第二次写入', done: false, priority: 'medium', tag: '', subtasks: [], version: todo.version }] },
    });

    const batch = await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: {
        items: [
          { id: null, text: '本应写入的新任务', done: false, priority: 'medium', tag: '', subtasks: [] },
          { id: todo.id, text: '过期写入', done: false, priority: 'medium', tag: '', subtasks: [], version: todo.version },
        ],
      },
    });

    assert.equal(batch.status, 409);
    const listed = await api('/workspace/todos', { token });
    assert.equal(listed.data.filter(item => item.text === '本应写入的新任务').length, 0, '冲突前的条目也应回滚');
  });

  withDatabase('冲突副本标题带后缀且不影响原任务', async () => {
    const { token } = await createUser('todo-conflict-copy');
    const todo = await createTodo(token, { text: '原始内容' });

    const copy = await api('/workspace/todos/conflict', {
      method: 'POST',
      token,
      body: { item: { id: todo.id, text: '本地版本', done: false, priority: 'medium', tag: '', subtasks: [] } },
    });

    assert.equal(copy.status, 201);
    assert.equal(copy.data.text, '本地版本（冲突副本）');
    assert.equal(copy.data.conflict_of, todo.id, '副本必须记录它覆盖的是哪一条原任务');
    assert.notEqual(copy.data.id, todo.id);

    const listed = await api('/workspace/todos', { token });
    assert.equal(listed.data.length, 1, '冲突副本不应混进常规任务列表');
    assert.equal(listed.data[0].id, todo.id);
  });

  withDatabase('软删除后列表不再返回，重复删除幂等', async () => {
    const { token } = await createUser('todo-delete');
    const todo = await createTodo(token, { text: '待删除' });

    const deleted = await api('/workspace/todos/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: todo.id, version: todo.version }] },
    });
    assert.equal(deleted.status, 200);

    const listed = await api('/workspace/todos', { token });
    assert.equal(listed.data.filter(item => item.id === todo.id).length, 0, '软删除的任务不应出现在列表中');

    const again = await api('/workspace/todos/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: todo.id, version: todo.version }] },
    });
    assert.equal(again.status, 200, '重复删除应幂等，不报冲突');
  });
});

describe('笔记', () => {
  withDatabase('新增与更新笔记，版本号自增且为数字', async () => {
    const { token } = await createUser('note-crud');
    const note = await createNote(token, { title: '第一篇', content: '正文内容' });

    assertNumericVersion(note, '笔记');
    assert.equal(note.version, 1);
    assert.equal(note.title, '第一篇');
    assert.equal(note.conflict_of, null);

    const updated = await api('/workspace/notes/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: note.id, title: '第一篇（改）', content: '新正文', version: note.version }] },
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.data[0].version, 2);
    assert.equal(updated.data[0].content, '新正文');
  });

  withDatabase('标题为空时回退为「未命名笔记」', async () => {
    const { token } = await createUser('note-title');
    const note = await createNote(token, { title: '' });

    assert.equal(note.title, '未命名笔记');
  });

  withDatabase('版本过期返回 409 且携带 conflictId', async () => {
    const { token } = await createUser('note-stale');
    const note = await createNote(token, { title: '原始' });

    await api('/workspace/notes/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: note.id, title: '先写入', content: 'a', version: note.version }] },
    });

    const stale = await api('/workspace/notes/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: note.id, title: '过期写入', content: 'b', version: note.version }] },
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.data.conflictId, note.id);
    assert.equal(stale.data.remote.version, 2);
  });

  withDatabase('删除后不可见，重复删除幂等', async () => {
    const { token } = await createUser('note-delete');
    const note = await createNote(token, { title: '待删除' });

    const deleted = await api('/workspace/notes/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: note.id, version: note.version }] },
    });
    assert.equal(deleted.status, 200);

    const listed = await api('/workspace/notes', { token });
    assert.equal(listed.data.filter(item => item.id === note.id).length, 0);

    const again = await api('/workspace/notes/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: note.id, version: note.version }] },
    });
    assert.equal(again.status, 200, '已删除的笔记再删不应报冲突');
  });

  withDatabase('冲突副本保留编辑时间并关联原笔记', async () => {
    const { token } = await createUser('note-conflict-copy');
    const note = await createNote(token, { title: '原始标题' });

    const copy = await api('/workspace/notes/conflict', {
      method: 'POST',
      token,
      body: { item: { id: note.id, title: '本地标题', content: '本地正文', updatedAt: '2026-09-28T00:00:00.000Z' } },
    });

    assert.equal(copy.status, 201);
    assert.equal(copy.data.title, '本地标题（冲突副本）');
    assert.equal(copy.data.conflict_of, note.id);
    assert.match(copy.data.content, /2026-09-28T00:00:00\.000Z/);
  });

  withDatabase('冲突副本不出现在笔记列表中', async () => {
    const { token } = await createUser('note-conflict-hidden');
    const note = await createNote(token, { title: '原始标题' });
    await api('/workspace/notes/conflict', { method: 'POST', token, body: { item: { id: note.id, title: '副本', content: 'x' } } });

    const listed = await api('/workspace/notes', { token });
    assert.equal(listed.data.length, 1, 'conflict_of 不为空的行应被列表过滤');
    assert.equal(listed.data[0].id, note.id);
  });
});

describe('快捷方式', () => {
  withDatabase('批量新增按下标写入 sort_order，列表按序返回', async () => {
    const { token } = await createUser('bookmark-order');
    const created = await api('/workspace/bookmarks/upsert', {
      method: 'POST',
      token,
      body: {
        items: [
          { id: null, name: '第一个', url: 'https://one.example', emoji: '1', color: '#111111', version: null },
          { id: null, name: '第二个', url: 'https://two.example', emoji: '2', color: '#222222', version: null },
          { id: null, name: '第三个', url: 'https://three.example', emoji: '3', color: '#333333', version: null },
        ],
      },
    });

    assert.equal(created.status, 200);
    assert.deepEqual(created.data.map(item => item.sort_order), [0, 1, 2]);

    const listed = await api('/workspace/bookmarks', { token });
    assert.deepEqual(listed.data.map(item => item.title), ['第一个', '第二个', '第三个']);
  });

  withDatabase('更新时按版本号自增，过期版本返回 409', async () => {
    const { token } = await createUser('bookmark-update');
    const bookmark = await createBookmark(token, { name: '原始名称' });

    const updated = await api('/workspace/bookmarks/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: bookmark.id, name: '新名称', url: bookmark.url, emoji: 'E', color: '#000000', version: bookmark.version }] },
    });

    assert.equal(updated.status, 200);
    assertNumericVersion(updated.data[0], '快捷方式');
    assert.equal(updated.data[0].version, 2);

    const stale = await api('/workspace/bookmarks/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: bookmark.id, name: '过期名称', url: bookmark.url, emoji: 'E', color: '#000000', version: bookmark.version }] },
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.data.conflictId, bookmark.id);
  });

  withDatabase('删除后列表不再返回', async () => {
    const { token } = await createUser('bookmark-delete');
    const bookmark = await createBookmark(token);

    const deleted = await api('/workspace/bookmarks/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: bookmark.id, version: bookmark.version }] },
    });
    assert.equal(deleted.status, 200);

    const listed = await api('/workspace/bookmarks', { token });
    assert.equal(listed.data.length, 0);
  });

  withDatabase('名称或地址为空返回 400', async () => {
    const { token } = await createUser('bookmark-invalid');

    const emptyName = await api('/workspace/bookmarks/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: null, name: '', url: 'https://example.com', emoji: 'E', color: '#000000' }] },
    });
    assert.equal(emptyName.status, 400);

    const emptyUrl = await api('/workspace/bookmarks/upsert', {
      method: 'POST',
      token,
      body: { items: [{ id: null, name: '名称', url: '', emoji: 'E', color: '#000000' }] },
    });
    assert.equal(emptyUrl.status, 400);
  });
});

describe('冲突处理', () => {
  withDatabase('冲突查询返回副本与对应的原条目', async () => {
    const { token } = await createUser('conflicts-list');
    const todo = await createTodo(token, { text: '原始任务' });
    const note = await createNote(token, { title: '原始笔记', content: '原正文' });

    await api('/workspace/todos/conflict', {
      method: 'POST',
      token,
      body: { item: { id: todo.id, text: '本地任务版本', done: false, priority: 'medium', tag: '', subtasks: [] } },
    });
    await api('/workspace/notes/conflict', {
      method: 'POST',
      token,
      body: { item: { id: note.id, title: '本地笔记版本', content: '本地正文' } },
    });

    const conflicts = await api('/workspace/conflicts', { token });

    assert.equal(conflicts.status, 200);
    assert.equal(conflicts.data.todos.length, 1);
    assert.equal(conflicts.data.todos[0].copy.text, '本地任务版本（冲突副本）');
    assert.equal(conflicts.data.todos[0].original.id, todo.id);
    assert.equal(conflicts.data.todos[0].original.text, '原始任务');

    assert.equal(conflicts.data.notes.length, 1);
    assert.equal(conflicts.data.notes[0].copy.title, '本地笔记版本（冲突副本）');
    assert.equal(conflicts.data.notes[0].original.id, note.id);
  });

  withDatabase('原条目被删除后冲突仍可查询，original 为 null', async () => {
    const { token } = await createUser('conflicts-orphan');
    const todo = await createTodo(token, { text: '会被删除的任务' });

    await api('/workspace/todos/conflict', {
      method: 'POST',
      token,
      body: { item: { id: todo.id, text: '副本', done: false, priority: 'medium', tag: '', subtasks: [] } },
    });
    await api('/workspace/todos/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: todo.id, version: todo.version }] },
    });

    const conflicts = await api('/workspace/conflicts', { token });
    assert.equal(conflicts.data.todos.length, 1);
    assert.equal(conflicts.data.todos[0].original, null, '原条目被软删除后应返回 null 而不是报错');
  });

  withDatabase('采用副本内容后原条目更新、副本被清理', async () => {
    const { token } = await createUser('conflicts-resolve');
    const todo = await createTodo(token, { text: '原始任务' });

    await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: {
        items: [{
          id: todo.id, text: '远端已更新', done: false, priority: 'medium', tag: '', subtasks: [], version: todo.version,
        }],
      },
    });
    await api('/workspace/todos/conflict', {
      method: 'POST',
      token,
      body: { item: { id: todo.id, text: '本地版本', done: true, priority: 'high', tag: '', subtasks: [] } },
    });

    const conflicts = await api('/workspace/conflicts', { token });
    const { copy, original } = conflicts.data.todos[0];

    // 客户端的「采用本地版本」：以原条目当前版本为基准写回副本内容，再删除副本。
    const applied = await api('/workspace/todos/upsert', {
      method: 'POST',
      token,
      body: {
        items: [{
          id: original.id,
          text: '本地版本',
          done: copy.done,
          priority: copy.priority,
          tag: copy.tag,
          subtasks: copy.subtasks,
          version: original.version,
        }],
      },
    });
    assert.equal(applied.status, 200);
    assert.equal(applied.data[0].text, '本地版本');

    const cleaned = await api('/workspace/todos/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: copy.id, version: copy.version }] },
    });
    assert.equal(cleaned.status, 200);

    const after = await api('/workspace/conflicts', { token });
    assert.equal(after.data.todos.length, 0, '处理完成后不应再出现在冲突列表');

    const listed = await api('/workspace/todos', { token });
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].text, '本地版本');
  });

  withDatabase('丢弃副本后原条目保持远端内容', async () => {
    const { token } = await createUser('conflicts-discard');
    const todo = await createTodo(token, { text: '原始任务' });

    await api('/workspace/todos/conflict', {
      method: 'POST',
      token,
      body: { item: { id: todo.id, text: '本地版本', done: false, priority: 'medium', tag: '', subtasks: [] } },
    });

    const conflicts = await api('/workspace/conflicts', { token });
    const { copy } = conflicts.data.todos[0];

    await api('/workspace/todos/delete', {
      method: 'POST',
      token,
      body: { items: [{ id: copy.id, version: copy.version }] },
    });

    const after = await api('/workspace/conflicts', { token });
    assert.equal(after.data.todos.length, 0);

    const listed = await api('/workspace/todos', { token });
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].text, '原始任务', '原条目应保持远端内容不变');
  });

  withDatabase('没有冲突时返回空数组', async () => {
    const { token } = await createUser('conflicts-empty');
    await createTodo(token, { text: '普通任务' });

    const conflicts = await api('/workspace/conflicts', { token });
    assert.deepEqual(conflicts.data, { todos: [], notes: [] });
  });

  withDatabase('冲突列表按账号隔离', async () => {
    const a = await createUser('conflicts-iso-a');
    const b = await createUser('conflicts-iso-b');
    const todo = await createTodo(a.token, { text: 'A 的任务' });

    await api('/workspace/todos/conflict', {
      method: 'POST',
      token: a.token,
      body: { item: { id: todo.id, text: 'A 的副本', done: false, priority: 'medium', tag: '', subtasks: [] } },
    });

    const bConflicts = await api('/workspace/conflicts', { token: b.token });
    assert.deepEqual(bConflicts.data, { todos: [], notes: [] });
  });

  withDatabase('超长内容仍保留冲突后缀，客户端才能还原原始文本', async () => {
    const { token } = await createUser('conflicts-long');
    const longText = 'x'.repeat(500);
    const todo = await createTodo(token, { text: longText });

    const copy = await api('/workspace/todos/conflict', {
      method: 'POST',
      token,
      body: { item: { id: todo.id, text: longText, done: false, priority: 'medium', tag: '', subtasks: [] } },
    });

    assert.equal(copy.status, 201);
    assert.ok(copy.data.text.endsWith('（冲突副本）'), '后缀不能被长度截断吃掉');
    assert.equal(copy.data.text.length, 500, '总长度仍需满足列约束');
  });
});

describe('变更轮询', () => {
  withDatabase('revision 覆盖四个资源，且只在实际变更时变化', async () => {
    const { token } = await createUser('revision');
    const before = await api('/workspace/revision', { token });

    assert.equal(before.status, 200);
    assert.deepEqual(Object.keys(before.data).sort(), ['bookmarks', 'notes', 'settings', 'todos']);

    await createTodo(token, { text: '触发任务变更' });
    const afterTodo = await api('/workspace/revision', { token });

    assert.notEqual(afterTodo.data.todos, before.data.todos, '任务 revision 应变化');
    assert.equal(afterTodo.data.notes, before.data.notes, '笔记 revision 不应受影响');
    assert.equal(afterTodo.data.bookmarks, before.data.bookmarks, '快捷方式 revision 不应受影响');
    assert.equal(afterTodo.data.settings, before.data.settings, '设置 revision 不应受影响');

    await createNote(token, { title: '触发笔记变更' });
    const afterNote = await api('/workspace/revision', { token });

    assert.notEqual(afterNote.data.notes, afterTodo.data.notes, '笔记 revision 应变化');
    assert.equal(afterNote.data.todos, afterTodo.data.todos, '任务 revision 不应受影响');
  });

  withDatabase('删除同样会改变 revision（不只看最大更新时间）', async () => {
    const { token } = await createUser('revision-delete');
    const todo = await createTodo(token, { text: '将被删除' });
    const before = await api('/workspace/revision', { token });

    await api('/workspace/todos/delete', { method: 'POST', token, body: { items: [{ id: todo.id, version: todo.version }] } });
    const after = await api('/workspace/revision', { token });

    assert.notEqual(after.data.todos, before.data.todos, '删除必须能被轮询感知');
  });
});
