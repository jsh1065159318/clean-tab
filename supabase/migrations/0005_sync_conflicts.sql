alter table public.notes
add column if not exists conflict_of uuid references public.notes(id) on delete set null;

create index if not exists notes_conflict_idx
on public.notes(user_id, conflict_of, updated_at desc);
