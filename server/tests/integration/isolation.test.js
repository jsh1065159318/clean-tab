import '../helpers/env.js';

import { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, createBookmark, createNote, createTodo, createUser } from '../helpers/client.js';
import { closeDatabase, withDatabase } from '../helpers/database.js';

after(closeDatabase);

describe('多账号隔离', () => {
  withDatabase('B 看不到 A 的任务、笔记与快捷方式', async () => {
    const a = await createUser('iso-read-a');
    const b = await createUser('iso-read-b');

    await createTodo(a.token, { text: 'A 的任务' });
    await createNote(a.token, { title: 'A 的笔记' });
    await createBookmark(a.token, { name: 'A 的站点' });

    assert.equal((await api('/workspace/todos', { token: b.token })).data.length, 0);
    assert.equal((await api('/workspace/notes', { token: b.token })).data.length, 0);
    assert.equal((await api('/workspace/bookmarks', { token: b.token })).data.length, 0);

    assert.equal((await api('/workspace/todos', { token: a.token })).data.length, 1, 'A 自己的数据应仍然可见');
  });

  withDatabase('B 携带正确版本号也无法改写 A 的任务', async () => {
    const a = await createUser('iso-write-a');
    const b = await createUser('iso-write-b');
    const todo = await createTodo(a.token, { text: 'A 的原始内容' });

    const updated = await api('/workspace/todos/upsert', {
      method: 'POST',
      token: b.token,
      body: {
        items: [{
          id: todo.id,
          text: '被 B 改写',
          done: false,
          priority: 'low',
          tag: '',
          subtasks: [],
          version: todo.version,
        }],
      },
    });

    assert.equal(updated.status, 409, '跨账号写入必须被拒绝');

    const after = await api('/workspace/todos', { token: a.token });
    assert.equal(after.data.length, 1);
    assert.equal(after.data[0].text, 'A 的原始内容', 'A 的内容不得被改动');
  });

  withDatabase('B 无法删除 A 的任务', async () => {
    const a = await createUser('iso-delete-a');
    const b = await createUser('iso-delete-b');
    const todo = await createTodo(a.token, { text: 'A 的任务' });

    const deleted = await api('/workspace/todos/delete', {
      method: 'POST',
      token: b.token,
      body: { items: [{ id: todo.id, version: todo.version }] },
    });

    // 删除按 user_id + id 定位，B 的请求命中 0 行，因此静默成功但不产生影响。
    assert.equal(deleted.status, 200);

    const after = await api('/workspace/todos', { token: a.token });
    assert.equal(after.data.length, 1);
    assert.equal(after.data[0].id, todo.id, 'A 的任务必须仍然存在');
  });

  withDatabase('B 无法删除 A 的笔记与快捷方式', async () => {
    const a = await createUser('iso-delete2-a');
    const b = await createUser('iso-delete2-b');
    const note = await createNote(a.token, { title: 'A 的笔记' });
    const bookmark = await createBookmark(a.token, { name: 'A 的站点' });

    await api('/workspace/notes/delete', { method: 'POST', token: b.token, body: { items: [{ id: note.id, version: note.version }] } });
    await api('/workspace/bookmarks/delete', { method: 'POST', token: b.token, body: { items: [{ id: bookmark.id, version: bookmark.version }] } });

    assert.equal((await api('/workspace/notes', { token: a.token })).data.length, 1);
    assert.equal((await api('/workspace/bookmarks', { token: a.token })).data.length, 1);
  });

  withDatabase('两个账号的设置相互独立', async () => {
    const a = await createUser('iso-settings-a');
    const b = await createUser('iso-settings-b');

    await api('/workspace/settings', {
      method: 'PUT',
      token: a.token,
      body: {
        theme: 'dark',
        greeting_name: 'A 的称呼',
        search_engine: 'google',
        background_mode: 'gradient',
        background_color: '#111827',
        background_image_url: '',
        show_greeting: true,
        show_quicklinks: true,
        version: 1,
      },
    });

    const bSettings = await api('/workspace/settings', { token: b.token });
    assert.equal(bSettings.data.theme, 'auto', 'B 的设置不应被 A 影响');
    assert.equal(bSettings.data.greeting_name, '');
    assert.equal(bSettings.data.version, 1);

    const aSettings = await api('/workspace/settings', { token: a.token });
    assert.equal(aSettings.data.theme, 'dark');
    assert.equal(aSettings.data.version, 2);
  });

  withDatabase('revision 只统计当前账号的数据', async () => {
    const a = await createUser('iso-revision-a');
    const b = await createUser('iso-revision-b');

    const before = await api('/workspace/revision', { token: b.token });
    await createTodo(a.token, { text: 'A 的任务' });
    const after = await api('/workspace/revision', { token: b.token });

    assert.equal(after.data.todos, before.data.todos, 'B 的 revision 不应因 A 的写入而变化');
  });
});
