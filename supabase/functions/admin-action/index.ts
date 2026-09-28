import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'AUTH_REQUIRED' }, 401);

    const projectUrl = Deno.env.get('SUPABASE_URL')!;
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(projectUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(projectUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'AUTH_REQUIRED' }, 401);

    const { data: roles, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    if (roleError) throw roleError;

    const roleNames = (roles || []).map(item => item.role);
    const isAdmin = roleNames.includes('admin');
    const isModerator = isAdmin || roleNames.includes('moderator');
    const body = await request.json();
    const action = body.action;

    if (!isModerator) return json({ error: 'FORBIDDEN' }, 403);
    if (action === 'set_role' && !isAdmin) return json({ error: 'FORBIDDEN' }, 403);

    let result;
    if (action === 'hide_message') {
      result = await adminClient.from('chat_messages').update({ status: 'hidden' }).eq('id', body.messageId);
      if (body.reportId) {
        const reportResult = await adminClient.from('chat_reports').update({ status: 'reviewed' }).eq('id', body.reportId);
        if (reportResult.error) throw reportResult.error;
      }
    } else if (action === 'ban_user') {
      result = await adminClient.from('chat_bans').insert({
        user_id: body.userId,
        room_id: body.roomId,
        operator_id: userData.user.id,
        reason: body.reason || '',
        expires_at: body.expiresAt || null,
      });
    } else if (action === 'resolve_report') {
      result = await adminClient.from('chat_reports').update({ status: body.status || 'reviewed' }).eq('id', body.reportId);
    } else if (action === 'set_role') {
      if (body.role) {
        result = await adminClient.from('user_roles').upsert({
          user_id: body.userId,
          role: body.role,
          created_by: userData.user.id,
        }, { onConflict: 'user_id,role' });
      } else {
        result = await adminClient.from('user_roles').delete().match({ user_id: body.userId, role: body.previousRole });
      }
    } else {
      return json({ error: 'VALIDATION_FAILED', message: 'Unsupported admin action.' }, 400);
    }

    if (result.error) throw result.error;

    const auditResult = await adminClient.from('admin_audit_logs').insert({
      operator_id: userData.user.id,
      action,
      target_type: body.targetType || 'chat',
      target_id: body.messageId || body.userId || body.reportId || null,
      metadata: body,
    });
    if (auditResult.error) throw auditResult.error;

    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
});
