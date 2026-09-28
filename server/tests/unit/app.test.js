// 必须先加载占位环境变量，否则 src/env.js 会在导入期抛错。
import '../helpers/env.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';

// 动态导入：确保上面的 env.js 已执行完毕。
const { app } = await import('../../src/app.js');

const jsonRequest = (path, { method = 'POST', body, origin } = {}) => app.request(path, {
  method,
  headers: {
    'content-type': 'application/json',
    ...(origin ? { origin } : {}),
  },
  body: JSON.stringify(body ?? {}),
});

test('健康检查返回 ok', async () => {
  const response = await app.request('/health');
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(typeof body.time === 'string' && !Number.isNaN(Date.parse(body.time)));
});

test('未知接口返回 404 且不泄露堆栈', async () => {
  const response = await app.request('/not-a-route');
  assert.equal(response.status, 404);

  const body = await response.json();
  assert.equal(body.error, 'NOT_FOUND');
  assert.ok(!('stack' in body));
});

test('浏览器扩展来源的预检请求被放行', async () => {
  for (const origin of ['chrome-extension://abcdefghijklmnop', 'moz-extension://abcdefghijklmnop']) {
    const response = await app.request('/workspace/todos', { method: 'OPTIONS', headers: { origin } });

    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-allow-methods'), /GET/);
    assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
  }
});

test('本地开发来源被放行', async () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    const response = await app.request('/health', { headers: { origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});

test('未授权来源不下发 CORS 头', async () => {
  const response = await app.request('/health', { headers: { origin: 'https://evil.example' } });

  assert.equal(response.status, 200, '服务本身仍会响应，是否放行由浏览器依据 CORS 头判断');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('缺少令牌访问 workspace 返回 401', async () => {
  const response = await app.request('/workspace/todos');
  assert.equal(response.status, 401);

  const body = await response.json();
  assert.equal(body.error, 'AUTH_REQUIRED');
});

test('登录请求体为空返回 400', async () => {
  const response = await jsonRequest('/auth/login', { body: {} });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'VALIDATION_FAILED');
});

test('请求体不是 JSON 对象返回 400', async () => {
  const response = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '"just-a-string"',
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'VALIDATION_FAILED');
});

test('邮箱格式非法返回 400 email_address_invalid', async () => {
  const response = await jsonRequest('/auth/login', { body: { email: 'not-an-email', password: 'long-enough' } });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'email_address_invalid');
});

test('注册密码过短返回 400', async () => {
  const response = await jsonRequest('/auth/signup', { body: { email: 'a@b.test', password: 'short' } });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'VALIDATION_FAILED');
  assert.match(body.message, /8/);
});

test('请求体超过 2 MB 返回 413', async () => {
  const oversized = JSON.stringify({ email: 'a@b.test', password: 'x'.repeat(2 * 1024 * 1024 + 1024) });

  const response = await app.request('/auth/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(oversized)),
    },
    body: oversized,
  });

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'PAYLOAD_TOO_LARGE');
});
