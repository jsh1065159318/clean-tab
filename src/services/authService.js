import { ApiError, apiRequest, sessionStore } from 'services/apiClient';
import { backendConfig } from 'config/backend';

const authErrorMessages = {
  AUTH_REQUIRED: '登录状态已失效，请重新登录。',
  FORBIDDEN: '当前暂未开放账号注册。',
  NOT_CONFIGURED: '同步服务尚未配置，请联系管理员。',
  NETWORK_ERROR: '网络连接失败，本地内容不受影响，请稍后重试。',
  PAYLOAD_TOO_LARGE: '请求内容过大，请精简后重试。',
  VALIDATION_FAILED: '提交的内容不合法，请检查后重试。',
  email_address_invalid: '邮箱格式不正确，请检查后重试。',
  email_exists: '该邮箱已注册，请直接登录。',
};

export const getAuthErrorMessage = (error, fallback = '操作失败，请稍后重试。') => {
  const code = error?.code || '';
  if (authErrorMessages[code]) return authErrorMessages[code];

  const rawMessage = error?.message || '';
  if (/failed to fetch|network|load failed/i.test(rawMessage)) {
    return '网络连接失败，本地内容不受影响，请稍后重试。';
  }

  // 服务端返回的都是中文提示，可直接展示。
  return /[\u3400-\u9fff]/.test(rawMessage) ? rawMessage : fallback;
};

const toSession = (payload, token) => ({
  accessToken: token,
  session: { token, user: payload?.user ?? null },
  user: payload?.user ?? null,
});

export const authService = {
  isConfigured: backendConfig.isConfigured,

  async getSession() {
    const token = sessionStore.getToken();
    if (!token) return { accessToken: null, session: null, user: null };

    try {
      const payload = await apiRequest('/auth/me');
      sessionStore.setUser(payload?.user ?? null);
      return toSession(payload, token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return { accessToken: null, session: null, user: null };
      }
      throw error;
    }
  },

  async getCurrentUser() {
    const session = await this.getSession();
    return session.user;
  },

  async signInWithPassword({ email, password }) {
    const payload = await apiRequest('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: email.trim().toLowerCase(), password },
    });
    sessionStore.set(payload.token, payload.user);
    return toSession(payload, payload.token);
  },

  async login(credentials) {
    const session = await this.signInWithPassword(credentials);
    return { accessToken: session.accessToken, user: session.user };
  },

  async signUp({ email, password, displayName = '' }) {
    const payload = await apiRequest('/auth/signup', {
      method: 'POST',
      auth: false,
      body: {
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
      },
    });
    // 自建后端没有邮箱确认环节，注册即登录。
    sessionStore.set(payload.token, payload.user);
    return toSession(payload, payload.token);
  },

  async signOut() {
    try {
      if (sessionStore.getToken()) await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      sessionStore.clear();
    }
  },

  async logout() {
    return this.signOut();
  },

  async me() {
    return this.getCurrentUser();
  },

  onAuthStateChange(callback) {
    return sessionStore.subscribe(() => {
      const token = sessionStore.getToken();
      const user = sessionStore.getUser();
      callback({
        event: token ? 'SIGNED_IN' : 'SIGNED_OUT',
        session: token ? { token, user } : null,
        user: token ? user : null,
      });
    });
  },
};
