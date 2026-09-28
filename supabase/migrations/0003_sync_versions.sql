alter table public.user_settings
add column if not exists version bigint not null default 1;

alter table public.bookmarks
add column if not exists version bigint not null default 1;

alter table public.todos
add column if not exists version bigint not null default 1;

alter table public.notes
add column if not exists version bigint not null default 1;

create or replace function public.bump_sync_version()
returns trigger
language plpgsql
as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists user_settings_sync_version on public.user_settings;
create trigger user_settings_sync_version
before update on public.user_settings
for each row execute function public.bump_sync_version();

drop trigger if exists bookmarks_sync_version on public.bookmarks;
create trigger bookmarks_sync_version
before update on public.bookmarks
for each row execute function public.bump_sync_version();

drop trigger if exists todos_sync_version on public.todos;
create trigger todos_sync_version
before update on public.todos
for each row execute function public.bump_sync_version();

drop trigger if exists notes_sync_version on public.notes;
create trigger notes_sync_version
before update on public.notes
for each row execute function public.bump_sync_version();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table public.user_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookmarks'
  ) then
    alter publication supabase_realtime add table public.bookmarks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ) then
    alter publication supabase_realtime add table public.todos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end;
$$;
