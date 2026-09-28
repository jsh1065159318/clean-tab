-- 0007_drop_chat.sql
-- 下线公共聊天与后台管理后端。
--
-- 背景：前端已移除公共聊天、MQTT 常驻连接与管理中心（见 OPTIMIZATION_PLAN 的 PROD-01），
-- 但 0001_workspace.sql 建表时仍保留了 chat_* 表、管理角色表及其 RLS 策略与 Edge Function。
-- 这些对象已无前端消费方，却持续对外暴露（chat_messages 还挂在 Realtime publication 上），
-- 本迁移将其完整清理，使数据库权限面与产品边界一致。
--
-- 警告：本迁移会永久删除聊天记录、举报、封禁与管理审计数据，且不可回滚。
--       请在确认无需保留历史数据后，再通过 `supabase db push` 或 Dashboard SQL Editor 手动执行。
--       执行后需一并删除 Edge Function：supabase/functions/chat-send、supabase/functions/admin-action
--       （本仓库已移除其源码），并确认 Supabase 项目中对应的函数已 undeploy。

-- 1. 将 chat_messages 从 Realtime 发布中移除
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime drop table public.chat_messages;
  end if;
end;
$$;

-- 2. 移除 profiles 上依赖管理角色的策略（profiles 表本身保留）
drop policy if exists "moderators can view profiles" on public.profiles;

-- 3. 删除聊天与后台管理相关表；策略、索引与 updated_at 触发器随表级联删除
drop table if exists public.chat_reports cascade;
drop table if exists public.chat_bans cascade;
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_rooms cascade;
drop table if exists public.admin_audit_logs cascade;
drop table if exists public.user_roles cascade;

-- 4. 删除管理角色判定函数（已无调用方）
drop function if exists public.has_moderation_role(uuid);
drop function if exists public.has_admin_role(uuid);
