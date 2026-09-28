import { Hono } from 'hono';
import { query, withTransaction } from '../db.js';
import { conflict } from '../lib/http.js';
import {
  isUuid,
  readArray,
  readBoolean,
  readEnum,
  readObject,
  readOptionalId,
  readString,
  readSubtasks,
  readTimestampOrNull,
  readVersion,
} from '../lib/validate.js';
import { currentAuth, requireAuth } from '../middleware/auth.js';

export const workspaceRoutes = new Hono();

workspaceRoutes.use('*', requireAuth);

const MAX_CONTENT_LENGTH = 200_000;

// 冲突副本的标题后缀，客户端据此还原出原始内容。
const CONFLICT_SUFFIX = '（冲突副本）';

// 必须先截断再加后缀：若先拼接再 slice，超长内容会把后缀一起截掉，
// 客户端就无法判断这是一份副本，也无法还原原始文本。
const toConflictLabel = (value, maxLength) =>
  `${value.slice(0, maxLength - CONFLICT_SUFFIX.length)}${CONFLICT_SUFFIX}`;

// ---------- 载荷解析 ----------

const readSettingsValues = body => [
  readEnum(body.theme, '主题', ['light', 'dark', 'auto'], 'auto'),
  readString(body.greeting_name ?? '', '问候语称呼', { max: 80 }),
  readString(body.search_engine ?? 'google', '搜索引擎', { max: 40 }),
  readString(body.background_mode ?? 'gradient', '背景模式', { max: 40 }),
  readString(body.background_color ?? '#111827', '背景颜色', { max: 32 }),
  readString(body.background_image_url ?? '', '背景图片地址', { max: 2048 }),
  readBoolean(body.show_greeting, '显示问候语', true),
  readBoolean(body.show_quicklinks, '显示快捷方式', true),
];

const readTodoItem = raw => {
  const item = readObject(raw);
  return {
    id: readOptionalId(item.id),
    text: readString(item.text, '任务内容', { min: 1, max: 500 }),
    done: readBoolean(item.done, '完成状态', false),
    priority: readEnum(item.priority, '优先级', ['high', 'medium', 'low'], 'medium'),
    tag: readString(item.tag ?? '', '标签', { max: 40 }),
    subtasks: readSubtasks(item.subtasks, '子任务'),
    dueAt: readTimestampOrNull(item.dueDate, '截止时间'),
    version: readVersion(item.version),
  };
};

const readNoteItem = raw => {
  const item = readObject(raw);
  return {
    id: readOptionalId(item.id),
    title: readString(item.title || '未命名笔记', '标题', { min: 1, max: 120 }),
    content: readString(item.content ?? '', '正文', { max: MAX_CONTENT_LENGTH }),
    version: readVersion(item.version),
  };
};

const readBookmarkItem = (raw, index) => {
  const item = readObject(raw);
  return {
    id: readOptionalId(item.id),
    title: readString(item.name, '名称', { min: 1, max: 80 }),
    url: readString(item.url, '地址', { min: 1, max: 2048 }),
    emoji: readString(item.emoji ?? '🔗', '图标', { max: 16 }),
    color: readString(item.color ?? '#6366f1', '颜色', { max: 32 }),
    sortOrder: index,
    version: readVersion(item.version),
  };
};

const readDeletionIds = raw => {
  const item = readObject(raw);
  return {
    id: readString(item.id, 'id', { min: 1, max: 64 }),
    version: readVersion(item.version),
  };
};

// ---------- 设置 ----------

workspaceRoutes.get('/settings', async c => {
  const { userId } = currentAuth(c);
  const result = await query('select * from user_settings where user_id = $1', [userId]);
  return c.json(result.rows[0] ?? null);
});

workspaceRoutes.put('/settings', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const values = readSettingsValues(body);
  const version = readVersion(body.version);

  if (version !== null) {
    const updated = await query(
      `update user_settings
          set theme = $2, greeting_name = $3, search_engine = $4, background_mode = $5,
              background_color = $6, background_image_url = $7, show_greeting = $8,
              show_quicklinks = $9, version = version + 1, updated_at = now()
        where user_id = $1 and version = $10
        returning *`,
      [userId, ...values, version],
    );
    if (updated.rowCount > 0) return c.json(updated.rows[0]);

    const remote = await query('select * from user_settings where user_id = $1', [userId]);
    throw conflict('设置已在其他设备更新。', remote.rows[0] ?? null);
  }

  const upserted = await query(
    `insert into user_settings (user_id, theme, greeting_name, search_engine, background_mode,
                                background_color, background_image_url, show_greeting, show_quicklinks)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (user_id) do update
        set theme = excluded.theme,
            greeting_name = excluded.greeting_name,
            search_engine = excluded.search_engine,
            background_mode = excluded.background_mode,
            background_color = excluded.background_color,
            background_image_url = excluded.background_image_url,
            show_greeting = excluded.show_greeting,
            show_quicklinks = excluded.show_quicklinks,
            version = user_settings.version + 1,
            updated_at = now()
     returning *`,
    [userId, ...values],
  );
  return c.json(upserted.rows[0]);
});

// ---------- 任务 ----------

workspaceRoutes.get('/todos', async c => {
  const { userId } = currentAuth(c);
  const result = await query(
    `select * from todos
      where user_id = $1 and deleted_at is null and conflict_of is null
      order by updated_at desc`,
    [userId],
  );
  return c.json(result.rows);
});

workspaceRoutes.post('/todos/upsert', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const items = readArray(body.items, 'items').map(readTodoItem);

  const rows = await withTransaction(async client => {
    const saved = [];
    for (const item of items) {
      if (item.version !== null && item.id) {
        const updated = await client.query(
          `update todos
              set text = $3, done = $4, priority = $5, tag = $6, subtasks = $7::jsonb,
                  due_at = $8, version = version + 1, updated_at = now()
            where user_id = $1 and id = $2 and version = $9 and deleted_at is null
            returning *`,
          [userId, item.id, item.text, item.done, item.priority, item.tag,
            JSON.stringify(item.subtasks), item.dueAt, item.version],
        );
        if (updated.rowCount > 0) {
          saved.push(updated.rows[0]);
          continue;
        }
        const remote = await client.query(
          'select * from todos where user_id = $1 and id = $2',
          [userId, item.id],
        );
        throw conflict('任务已在其他设备更新。', remote.rows[0] ?? null, item.id);
      }

      const upserted = await client.query(
        `insert into todos (id, user_id, text, done, priority, tag, subtasks, due_at)
         values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7::jsonb, $8)
         on conflict (id) do update
            set text = excluded.text, done = excluded.done, priority = excluded.priority,
                tag = excluded.tag, subtasks = excluded.subtasks, due_at = excluded.due_at,
                version = todos.version + 1, updated_at = now()
          where todos.user_id = excluded.user_id
         returning *`,
        [item.id, userId, item.text, item.done, item.priority, item.tag,
          JSON.stringify(item.subtasks), item.dueAt],
      );
      if (upserted.rowCount === 0) {
        throw conflict('任务已被其他账号占用。', null, item.id);
      }
      saved.push(upserted.rows[0]);
    }
    return saved;
  });

  return c.json(rows);
});

workspaceRoutes.post('/todos/delete', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const items = readArray(body.items, 'items').map(readDeletionIds);

  await withTransaction(async client => {
    for (const item of items) {
      const params = [userId, item.id];
      let sql = `update todos
                    set deleted_at = now(), version = version + 1, updated_at = now()
                  where user_id = $1 and id = $2 and deleted_at is null`;
      if (item.version !== null) {
        sql += ' and version = $3';
        params.push(item.version);
      }
      const result = await client.query(`${sql} returning id`, params);
      if (result.rowCount > 0 || item.version === null) continue;

      const remote = await client.query(
        'select * from todos where user_id = $1 and id = $2',
        [userId, item.id],
      );
      const row = remote.rows[0];
      if (row && row.deleted_at === null) {
        throw conflict('任务已在其他设备更新。', row, item.id);
      }
    }
  });

  return c.json({ ok: true });
});

workspaceRoutes.post('/todos/conflict', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const raw = readObject(body.item ?? body);
  const item = readTodoItem(raw);

  const result = await query(
    `insert into todos (user_id, text, done, priority, tag, subtasks, due_at, conflict_of)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     returning *`,
    [userId, toConflictLabel(item.text, 500), item.done, item.priority, item.tag,
      JSON.stringify(item.subtasks), item.dueAt, isUuid(raw.id) ? raw.id : null],
  );
  return c.json(result.rows[0], 201);
});

// ---------- 笔记 ----------

workspaceRoutes.get('/notes', async c => {
  const { userId } = currentAuth(c);
  const result = await query(
    `select * from notes
      where user_id = $1 and conflict_of is null
      order by updated_at desc`,
    [userId],
  );
  return c.json(result.rows);
});

workspaceRoutes.post('/notes/upsert', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const items = readArray(body.items, 'items').map(readNoteItem);

  const rows = await withTransaction(async client => {
    const saved = [];
    for (const item of items) {
      if (item.version !== null && item.id) {
        const updated = await client.query(
          `update notes
              set title = $3, content = $4, version = version + 1, updated_at = now()
            where user_id = $1 and id = $2 and version = $5 and conflict_of is null
            returning *`,
          [userId, item.id, item.title, item.content, item.version],
        );
        if (updated.rowCount > 0) {
          saved.push(updated.rows[0]);
          continue;
        }
        const remote = await client.query(
          'select * from notes where user_id = $1 and id = $2',
          [userId, item.id],
        );
        throw conflict('笔记已在其他设备更新。', remote.rows[0] ?? null, item.id);
      }

      const upserted = await client.query(
        `insert into notes (id, user_id, title, content)
         values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4)
         on conflict (id) do update
            set title = excluded.title, content = excluded.content,
                version = notes.version + 1, updated_at = now()
          where notes.user_id = excluded.user_id
         returning *`,
        [item.id, userId, item.title, item.content],
      );
      if (upserted.rowCount === 0) {
        throw conflict('笔记已被其他账号占用。', null, item.id);
      }
      saved.push(upserted.rows[0]);
    }
    return saved;
  });

  return c.json(rows);
});

workspaceRoutes.post('/notes/delete', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const items = readArray(body.items, 'items').map(readDeletionIds);

  await withTransaction(async client => {
    for (const item of items) {
      const params = [userId, item.id];
      let sql = 'delete from notes where user_id = $1 and id = $2';
      if (item.version !== null) {
        sql += ' and version = $3';
        params.push(item.version);
      }
      const result = await client.query(`${sql} returning id`, params);
      if (result.rowCount > 0 || item.version === null) continue;

      const remote = await client.query(
        'select * from notes where user_id = $1 and id = $2',
        [userId, item.id],
      );
      if (remote.rows[0]) {
        throw conflict('笔记已在其他设备更新。', remote.rows[0], item.id);
      }
    }
  });

  return c.json({ ok: true });
});

workspaceRoutes.post('/notes/conflict', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const raw = readObject(body.item ?? body);
  const item = readNoteItem(raw);

  const result = await query(
    `insert into notes (user_id, title, content, conflict_of)
     values ($1, $2, $3, $4)
     returning *`,
    [
      userId,
      toConflictLabel(item.title, 120),
      `本地冲突副本，编辑时间：${raw.updatedAt || '未知'}\n\n${item.content}`,
      isUuid(raw.id) ? raw.id : null,
    ],
  );
  return c.json(result.rows[0], 201);
});

// ---------- 快捷方式 ----------

workspaceRoutes.get('/bookmarks', async c => {
  const { userId } = currentAuth(c);
  const result = await query(
    'select * from bookmarks where user_id = $1 order by sort_order, created_at',
    [userId],
  );
  return c.json(result.rows);
});

workspaceRoutes.post('/bookmarks/upsert', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const items = readArray(body.items, 'items').map(readBookmarkItem);

  const rows = await withTransaction(async client => {
    const saved = [];
    for (const item of items) {
      if (item.version !== null && item.id) {
        const updated = await client.query(
          `update bookmarks
              set title = $3, url = $4, emoji = $5, color = $6, sort_order = $7,
                  version = version + 1, updated_at = now()
            where user_id = $1 and id = $2 and version = $8
            returning *`,
          [userId, item.id, item.title, item.url, item.emoji, item.color, item.sortOrder, item.version],
        );
        if (updated.rowCount > 0) {
          saved.push(updated.rows[0]);
          continue;
        }
        const remote = await client.query(
          'select * from bookmarks where user_id = $1 and id = $2',
          [userId, item.id],
        );
        throw conflict('快捷方式已在其他设备更新。', remote.rows[0] ?? null, item.id);
      }

      const upserted = await client.query(
        `insert into bookmarks (id, user_id, title, url, emoji, color, sort_order)
         values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
         on conflict (id) do update
            set title = excluded.title, url = excluded.url, emoji = excluded.emoji,
                color = excluded.color, sort_order = excluded.sort_order,
                version = bookmarks.version + 1, updated_at = now()
          where bookmarks.user_id = excluded.user_id
         returning *`,
        [item.id, userId, item.title, item.url, item.emoji, item.color, item.sortOrder],
      );
      if (upserted.rowCount === 0) {
        throw conflict('快捷方式已被其他账号占用。', null, item.id);
      }
      saved.push(upserted.rows[0]);
    }
    return saved;
  });

  return c.json(rows);
});

workspaceRoutes.post('/bookmarks/delete', async c => {
  const { userId } = currentAuth(c);
  const body = readObject(await c.req.json().catch(() => null));
  const items = readArray(body.items, 'items').map(readDeletionIds);

  await withTransaction(async client => {
    for (const item of items) {
      const params = [userId, item.id];
      let sql = 'delete from bookmarks where user_id = $1 and id = $2';
      if (item.version !== null) {
        sql += ' and version = $3';
        params.push(item.version);
      }
      const result = await client.query(`${sql} returning id`, params);
      if (result.rowCount > 0 || item.version === null) continue;

      const remote = await client.query(
        'select * from bookmarks where user_id = $1 and id = $2',
        [userId, item.id],
      );
      if (remote.rows[0]) {
        throw conflict('快捷方式已在其他设备更新。', remote.rows[0], item.id);
      }
    }
  });

  return c.json({ ok: true });
});

// ---------- 冲突处理 ----------

// 冲突副本由客户端在收到 409 后自动创建：把本地版本另存为一份副本，同时接受远端版本。
// 副本不进入常规列表（todos 与 notes 均按 conflict_of is null 过滤），
// 因此需要单独查询，供用户在同步面板中逐条决定保留哪一版。
//
// filter 会同时作用于副本与原条目查询：原条目若已被软删除，
// 就不应再作为「被覆盖的版本」呈现给用户，此时 original 返回 null。
const loadConflicts = async (table, userId, filter = '') => {
  const copies = await query(
    `select * from ${table}
      where user_id = $1 and conflict_of is not null ${filter}
      order by updated_at desc`,
    [userId],
  );

  const originalIds = [...new Set(copies.rows.map(row => row.conflict_of))];
  const originals = originalIds.length > 0
    ? await query(
      `select * from ${table}
        where user_id = $1 and id = any($2::uuid[]) ${filter}`,
      [userId, originalIds],
    )
    : { rows: [] };
  const originalById = new Map(originals.rows.map(row => [row.id, row]));

  return copies.rows.map(copy => ({ copy, original: originalById.get(copy.conflict_of) ?? null }));
};

workspaceRoutes.get('/conflicts', async c => {
  const { userId } = currentAuth(c);
  return c.json({
    todos: await loadConflicts('todos', userId, 'and deleted_at is null'),
    notes: await loadConflicts('notes', userId),
  });
});

// ---------- 变更轮询 ----------

// 每个资源返回「最大更新时间 + 行数」组成的版本串。
// 前端只需比较该串即可判断是否需要重新拉取，无需维持长连接。
workspaceRoutes.get('/revision', async c => {
  const { userId } = currentAuth(c);
  const result = await query(
    `select 'todos' as resource,
            coalesce(max(updated_at)::text, '') || ':' || count(*)::text as revision
       from todos where user_id = $1
     union all
     select 'notes', coalesce(max(updated_at)::text, '') || ':' || count(*)::text
       from notes where user_id = $1
     union all
     select 'bookmarks', coalesce(max(updated_at)::text, '') || ':' || count(*)::text
       from bookmarks where user_id = $1
     union all
     select 'settings', coalesce(max(updated_at)::text, '') || ':' || count(*)::text
       from user_settings where user_id = $1`,
    [userId],
  );

  const revisions = { todos: '', notes: '', bookmarks: '', settings: '' };
  for (const row of result.rows) revisions[row.resource] = row.revision;
  return c.json(revisions);
});
