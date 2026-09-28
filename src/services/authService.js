import { supabase } from 'services/supabaseClient';
import { supabaseConfig } from 'config/supabase';

const notConfigured = () => {
  throw new Error('Supabase 尚未配置，暂时无法使用账号功能。');
};

const authErrorMessages = {
  captcha_failed: '安全验证失败，请刷新页面后重试。',
  email_address_invalid: '邮箱格式不正确，请检查后重试。',
  email_exists: '该邮箱已注册，请直接登录。',
  email_not_confirmed: '当前云端仍要求邮箱确认，请联系管理员关闭邮箱验证。',
  identity_already_exists: '该邮箱已注册，请直接登录。',
  invalid_credentials: '邮箱或密码错误，请检查后重试。',
  over_email_send_rate_limit: '操作过于频繁，请稍后再试。',
  over_request_rate_limit: '请求过于频繁，请稍后再试。',
  signup_disabled: '当前暂未开放账号注册。',
  user_already_exists: '该邮箱已注册，请直接登录。',
  weak_password: '密码强度不足，请使用至少 8 位字符。',
};

export const getAuthErrorMessage = (error, fallback = '操作失败，请稍后重试。') => {
  const code = error?.code || '';
  if (authErrorMessages[code]) return authErrorMessages[code];

  const rawMessage = error?.message || '';
  if (/failed to fetch|network|load failed/i.test(rawMessage)) {
    return '网络连接失败，本地内容不受影响，请稍后重试。';
  }

  return /[\u3400-\u9fff]/.test(rawMessage) ? rawMessage : fallback;
};

export const authService = {
  isConfigured: supabaseConfig.isConfigured,

  // Keep the original service contract while the backend moves to Supabase.
  async getSession() {
    if (!supabase) return { accessToken: null, session: null, user: null };

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      accessToken: data.session?.access_token || null,
      session: data.session || null,
      user: data.session?.user || null,
    };
  },

  async getCurrentUser() {
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  async signInWithPassword({ email, password }) {
    if (!supabase) return notConfigured();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    return data;
  },

  async login(credentials) {
    const data = await this.signInWithPassword(credentials);
    return {
      accessToken: data.session?.access_token || null,
      user: data.user || null,
    };
  },

  async signUp({ email, password, displayName = '' }) {
    if (!supabase) return notConfigured();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) throw error;
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const existingUserError = new Error('该邮箱已注册，请直接登录。');
      existingUserError.code = 'user_already_exists';
      throw existingUserError;
    }
    return data;
  },

  async sendMagicLink(email, redirectTo = window.location.origin) {
    if (!supabase) return notConfigured();

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!supabase) return notConfigured();

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },

  async logout() {
    return this.signOut();
  },

  async me() {
    return this.getCurrentUser();
  },

  onAuthStateChange(callback) {
    if (!supabase) return () => {};

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback({ event, session, user: session?.user || null });
    });

    return () => data.subscription.unsubscribe();
  },
};
