-- 清爽标签页自建后端数据库结构
-- 目标：PostgreSQL 13 及以上。脚本可重复执行。
--
-- 与 Supabase 版本的差异：
-- 1. 用户表由本服务自持（users），不再依赖 Supabase Auth。
-- 2. 不使用行级安全（RLS）——本服务是唯一的数据访问入口，
--    归属校验统一在 API 层用 user_id 条件完成，避免依赖会话变量注入。
-- 3. 版本号不再使用触发器自增，而是在 UPDATE 语句中显式 version = version + 1，
--    使乐观锁语义在代码里可读、可测试。

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 会话令牌只存 SHA-256 摘要，数据库泄露时无法直接用于登录。
create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  theme text not null default 'auto' check (theme in ('light', 'dark', 'auto')),
  greeting_name text not null default '',
  search_engine text not null default 'google',
  background_mode text not null default 'gradient',
  background_color text not null default '#111827',
  background_image_url text not null default '',
  show_greeting boolean not null default true,
  show_quicklinks boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) between 1 and 2048),
  emoji text not null default '🔗',
  color text not null default '#6366f1',
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  done boolean not null default false,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  tag text not null default '',
  subtasks jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  deleted_at timestamptz,
  -- 指向被冲突覆盖的原任务。非空表示这一行是「冲突副本」，
  -- 与 notes.conflict_of 语义一致，不应出现在常规列表中。
  conflict_of uuid references todos(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todos_subtasks_array check (jsonb_typeof(subtasks) = 'array')
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default '未命名笔记' check (char_length(title) between 1 and 120),
  content text not null default '',
  conflict_of uuid references notes(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookmarks_user_order_idx on bookmarks (user_id, sort_order);
create index if not exists todos_user_updated_idx on todos (user_id, updated_at desc);
create index if not exists todos_user_deleted_idx on todos (user_id, deleted_at) where deleted_at is not null;
create index if not exists todos_conflict_idx on todos (user_id, conflict_of) where conflict_of is not null;
create index if not exists notes_user_updated_idx on notes (user_id, updated_at desc);
create index if not exists notes_conflict_idx on notes (user_id, conflict_of, updated_at desc);

-- version 必须使用 integer 而不是 bigint：
-- node-postgres 默认把 int8 解析为字符串（避免超出 JS 安全整数范围），
-- 而前端用 Number.isInteger(version) 判断是否携带版本号，
-- 返回字符串会让乐观锁静默失效。integer 上限 21 亿次写入，对本场景足够。
-- 下面四条 ALTER 为幂等修正，兼容早期建表使用 bigint 的数据库。
alter table user_settings alter column version type integer;
alter table bookmarks alter column version type integer;
alter table todos alter column version type integer;
alter table notes alter column version type integer;

-- 为既有数据库补齐任务侧的 conflict_of（幂等）。
-- 早期版本只有 notes 记录了冲突来源，导致任务冲突副本既无法被识别，
-- 又会以「xxx（冲突副本）」的形式混进常规任务列表。
alter table todos add column if not exists conflict_of uuid references todos(id) on delete set null;

create index if not exists todos_conflict_idx on todos (user_id, conflict_of) where conflict_of is not null;
