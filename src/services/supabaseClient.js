import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from 'config/supabase';

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase 尚未配置，请填写 .env.local 中的项目 URL 和公开密钥。');
  }

  return supabase;
}
