alter table public.chat_messages
add column if not exists sender_name text not null default ''
check (char_length(sender_name) <= 80);

update public.chat_messages
set sender_name = '用户 ' || left(user_id::text, 6)
where sender_name = '';
