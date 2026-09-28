create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'auto' check (theme in ('light', 'dark', 'auto')),
  greeting_name text not null default '',
  search_engine text not null default 'google',
  background_mode text not null default 'gradient',
  background_color text not null default '#111827',
  background_image_url text not null default '',
  show_greeting boolean not null default true,
  show_quicklinks boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) between 1 and 2048),
  emoji text not null default '🔗',
  color text not null default '#6366f1',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  done boolean not null default false,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  tag text not null default '工作',
  due_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名笔记' check (char_length(title) between 1 and 120),
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  message_type text not null default 'text' check (message_type in ('text', 'system')),
  reply_to uuid references public.chat_messages(id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_bans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operator_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists bookmarks_user_order_idx on public.bookmarks(user_id, sort_order);
create index if not exists todos_user_updated_idx on public.todos(user_id, updated_at desc);
create index if not exists notes_user_updated_idx on public.notes(user_id, updated_at desc);
create index if not exists chat_messages_room_created_idx on public.chat_messages(room_id, created_at desc);
create index if not exists chat_reports_status_idx on public.chat_reports(status, created_at desc);
create index if not exists user_roles_role_idx on public.user_roles(role, created_at desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists bookmarks_updated_at on public.bookmarks;
create trigger bookmarks_updated_at
before update on public.bookmarks
for each row execute function public.set_updated_at();

drop trigger if exists todos_updated_at on public.todos;
create trigger todos_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists chat_rooms_updated_at on public.chat_rooms;
create trigger chat_rooms_updated_at
before update on public.chat_rooms
for each row execute function public.set_updated_at();

drop trigger if exists chat_messages_updated_at on public.chat_messages;
create trigger chat_messages_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.chat_rooms (name, visibility, status)
select '公共大厅', 'public', 'active'
where not exists (
  select 1 from public.chat_rooms where name = '公共大厅'
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.bookmarks enable row level security;
alter table public.todos enable row level security;
alter table public.notes enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_bans enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.has_moderation_role(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role in ('admin', 'moderator')
  );
$$;

create or replace function public.has_admin_role(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role = 'admin'
  );
$$;

create policy "users can view own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "moderators can view profiles"
on public.profiles for select
to authenticated
using (public.has_moderation_role());

create policy "users can manage own settings"
on public.user_settings for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can manage own bookmarks"
on public.bookmarks for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can manage own todos"
on public.todos for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can manage own notes"
on public.notes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "everyone can view active public rooms"
on public.chat_rooms for select
to anon, authenticated
using (visibility = 'public' and status = 'active');

create policy "everyone can view visible public messages"
on public.chat_messages for select
to anon, authenticated
using (
  status = 'visible'
  and exists (
    select 1
    from public.chat_rooms room
    where room.id = room_id
      and room.visibility = 'public'
      and room.status = 'active'
  )
);

create policy "users can update own messages"
on public.chat_messages for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "moderators can moderate messages"
on public.chat_messages for update
to authenticated
using (public.has_moderation_role())
with check (public.has_moderation_role());

create policy "moderators can view reports"
on public.chat_reports for select
to authenticated
using (public.has_moderation_role());

create policy "moderators can update reports"
on public.chat_reports for update
to authenticated
using (public.has_moderation_role())
with check (public.has_moderation_role());

create policy "moderators can manage bans"
on public.chat_bans for all
to authenticated
using (public.has_moderation_role())
with check (public.has_moderation_role());

create policy "users can view own roles"
on public.user_roles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "admins can view all roles"
on public.user_roles for select
to authenticated
using (public.has_admin_role());

create policy "admins can view audit logs"
on public.admin_audit_logs for select
to authenticated
using (public.has_admin_role());

create policy "users can report messages"
on public.chat_reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

create policy "users can view own reports"
on public.chat_reports for select
to authenticated
using ((select auth.uid()) = reporter_id);

alter publication supabase_realtime add table public.chat_messages;
