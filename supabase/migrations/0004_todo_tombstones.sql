alter table public.todos
add column if not exists deleted_at timestamptz;

create index if not exists todos_user_deleted_idx
on public.todos(user_id, deleted_at)
where deleted_at is not null;
