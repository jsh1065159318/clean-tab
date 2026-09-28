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

    const { roomId, content, replyTo } = await request.json();
    const cleanContent = String(content || '').trim();
    const cleanReplyTo = replyTo ? String(replyTo) : null;
    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    if (!roomId || cleanContent.length < 1 || cleanContent.length > 1000 || (cleanReplyTo && !isUuid(cleanReplyTo))) {
      return json({ error: 'VALIDATION_FAILED' }, 400);
    }

    const { data: room, error: roomError } = await adminClient
      .from('chat_rooms')
      .select('id')
      .eq('id', roomId)
      .eq('visibility', 'public')
      .eq('status', 'active')
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return json({ error: 'FORBIDDEN' }, 403);

    if (cleanReplyTo) {
      const { data: replyMessage, error: replyError } = await adminClient
        .from('chat_messages')
        .select('id')
        .eq('id', cleanReplyTo)
        .eq('room_id', roomId)
        .eq('status', 'visible')
        .maybeSingle();
      if (replyError) throw replyError;
      if (!replyMessage) return json({ error: 'INVALID_REPLY' }, 400);
    }

    const { data: activeBan, error: banError } = await adminClient
      .from('chat_bans')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userData.user.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();
    if (banError) throw banError;
    if (activeBan) return json({ error: 'FORBIDDEN', message: '你暂时不能在此房间发言。' }, 403);

    const since = new Date(Date.now() - 30_000).toISOString();
    const { count, error: countError } = await adminClient
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.user.id)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count || 0) >= 10) return json({ error: 'RATE_LIMITED' }, 429);

    const { data: message, error: insertError } = await adminClient
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userData.user.id,
        sender_name: String(
          userData.user.user_metadata?.display_name
          || userData.user.email?.split('@')[0]
          || `用户 ${userData.user.id.slice(0, 6)}`,
        ).slice(0, 80),
        content: cleanContent,
        reply_to: cleanReplyTo,
      })
      .select('id, room_id, user_id, sender_name, content, message_type, reply_to, status, created_at')
      .single();
    if (insertError) throw insertError;

    return json({ message });
  } catch (error) {
    console.error(error);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
});
