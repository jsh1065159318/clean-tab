import { backendConfig } from 'config/backend';
import { STORAGE_KEYS } from 'constants/storageKeys';
import { storageService } from 'services/storageService';

export class ApiError extends Error {
  constructor(status, code, message, payload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

let cachedToken = null;
let cachedUser = null;
const sessionListeners = new Set();

const notifySessionChange = () => {
  sessionListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('会话状态监听器执行失败：', error);
    }
  });
};

// 会话令牌保存在本地存储中，用户信息只驻留内存，每次启动通过 /auth/me 重新拉取。
export const sessionStore = {
  getToken() {
    if (cachedToken === null) {
      cachedToken = storageService.getJSON(STORAGE_KEYS.sessionToken, '');
    }
    return cachedToken;
  },

  getUser: () => cachedUser,

  // 静默刷新用户信息，不触发变更通知，避免与 getSession 形成回环。
  setUser(user) {
    cachedUser = user ?? null;
  },

  set(token, user = null) {
    cachedToken = token || '';
    cachedUser = token ? user ?? null : null;
    storageService.setJSON(STORAGE_KEYS.sessionToken, cachedToken);
    notifySessionChange();
  },

  clear() {
    this.set('', null);
  },

  subscribe(listener) {
    sessionListeners.add(listener);
    return () => sessionListeners.delete(listener);
  },
};

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  if (!backendConfig.isConfigured) {
    throw new ApiError(0, 'NOT_CONFIGURED', '同步服务尚未配置，请填写 .env.local 中的 VITE_API_BASE_URL。');
  }

  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) {
    const token = sessionStore.getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${backendConfig.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败，本地内容不受影响。', { cause: String(error) });
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    // 携带令牌的请求收到 401，说明会话已失效，立即清理本地令牌。
    if (response.status === 401 && auth) sessionStore.clear();
    throw new ApiError(
      response.status,
      payload?.error || `HTTP_${response.status}`,
      payload?.message || '请求失败，请稍后重试。',
      payload ?? {},
    );
  }

  return payload;
}
