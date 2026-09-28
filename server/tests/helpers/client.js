import { app } from '../../src/app.js';
import { uniqueEmail } from './database.js';

export const PASSWORD = 'correct-horse-battery';

// 直接调用 Hono 的 app.request()，在进程内完成请求，
// 无需监听端口，也不存在端口占用与并发冲突。
export const api = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';
  if (token) requestHeaders.authorization = `Bearer ${token}`;

  const response = await app.request(path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return { status: response.status, data, headers: response.headers };
};

export const createUser = async (prefix = 'user') => {
  const email = uniqueEmail(prefix);
  const response = await api('/auth/signup', {
    method: 'POST',
    body: { email, password: PASSWORD, displayName: prefix },
  });
  return { email, password: PASSWORD, token: response.data?.token ?? '', response };
};

export const createTodo = async (token, overrides = {}) => {
  const response = await api('/workspace/todos/upsert', {
    method: 'POST',
    token,
    body: {
      items: [{
        id: null,
        text: '测试任务',
        done: false,
        priority: 'medium',
        tag: '',
        subtasks: [],
        ...overrides,
      }],
    },
  });
  return response.data?.[0] ?? null;
};

export const createNote = async (token, overrides = {}) => {
  const response = await api('/workspace/notes/upsert', {
    method: 'POST',
    token,
    body: {
      items: [{ id: null, title: '测试笔记', content: '正文', version: null, ...overrides }],
    },
  });
  return response.data?.[0] ?? null;
};

export const createBookmark = async (token, overrides = {}) => {
  const response = await api('/workspace/bookmarks/upsert', {
    method: 'POST',
    token,
    body: {
      items: [{
        id: null,
        name: '示例站点',
        url: 'https://example.com',
        emoji: 'E',
        color: '#6366f1',
        version: null,
        ...overrides,
      }],
    },
  });
  return response.data?.[0] ?? null;
};
