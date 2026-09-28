alter table public.todos
add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table public.todos
drop constraint if exists todos_subtasks_array;

alter table public.todos
add constraint todos_subtasks_array
check (jsonb_typeof(subtasks) = 'array');
