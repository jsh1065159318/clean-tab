import '../helpers/env.js';

import { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, createUser, PASSWORD } from '../helpers/client.js';
import { closeDatabase, uniqueEmail, withDatabase } from '../helpers/database.js';

after(closeDatabase);

describe('注册', () => {
  withDatabase('注册成功返回 201、可用令牌与用户信息', async () => {
    const { email, token, response } = await createUser('signup');

    assert.equal(response.status, 201);
    assert.equal(response.data.user.email, email);
    assert.equal(response.data.user.displayName, 'signup');
    assert.ok(token.length >= 32, '令牌应有足够熵');
    assert.ok(Date.parse(response.data.expiresAt) > Date.now(), '过期时间应在未来');
  });

  withDatabase('注册响应不包含密码哈希', async () => {
    const { response } = await createUser('nohash');
    const serialized = JSON.stringify(response.data);

    assert.ok(!serialized.includes('password'), '响应中不得出现 password 字段');
    assert.ok(!serialized.includes('scrypt'), '响应中不得出现密码哈希');
  });

  withDatabase('重复邮箱返回 400 email_exists', async () => {
    const { email } = await createUser('dup');
    const again = await api('/auth/signup', {
      method: 'POST',
      body: { email, password: PASSWORD, displayName: '重复' },
    });

    assert.equal(again.status, 400);
    assert.equal(again.data.error, 'email_exists');
  });

  withDatabase('邮箱大小写不敏感，视为同一账号', async () => {
    const { email } = await createUser('case');
    const upper = await api('/auth/signup', {
      method: 'POST',
      body: { email: email.toUpperCase(), password: PASSWORD, displayName: '大写' },
    });

    assert.equal(upper.status, 400);
    assert.equal(upper.data.error, 'email_exists');
  });

  withDatabase('邮箱格式非法返回 400 email_address_invalid', async () => {
    const response = await api('/auth/signup', {
      method: 'POST',
      body: { email: 'not-an-email', password: PASSWORD, displayName: '格式' },
    });

    assert.equal(response.status, 400);
    assert.equal(response.data.error, 'email_address_invalid');
  });

  withDatabase('密码短于 8 位返回 400', async () => {
    const response = await api('/auth/signup', {
      method: 'POST',
      body: { email: uniqueEmail('weak'), password: 'short', displayName: '弱密码' },
    });

    assert.equal(response.status, 400);
    assert.equal(response.data.error, 'VALIDATION_FAILED');
  });
});

describe('登录与会话', () => {
  withDatabase('密码正确时登录成功并签发新令牌', async () => {
    const { email, token } = await createUser('login');
    const response = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });

    assert.equal(response.status, 200);
    assert.equal(response.data.user.email, email);
    assert.ok(response.data.token.length >= 32);
    assert.notEqual(response.data.token, token, '每次登录应签发独立会话');
  });

  withDatabase('密码错误返回 401', async () => {
    const { email } = await createUser('badpass');
    const response = await api('/auth/login', { method: 'POST', body: { email, password: 'wrong-password-here' } });

    assert.equal(response.status, 401);
    assert.equal(response.data.error, 'AUTH_REQUIRED');
  });

  withDatabase('账号不存在与密码错误的响应完全一致，不泄露账号是否注册', async () => {
    const { email } = await createUser('probe');
    const wrongPassword = await api('/auth/login', { method: 'POST', body: { email, password: 'wrong-password-here' } });
    const unknownAccount = await api('/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail('ghost'), password: 'wrong-password-here' },
    });

    assert.equal(unknownAccount.status, wrongPassword.status);
    assert.equal(unknownAccount.data.error, wrongPassword.data.error);
    assert.equal(unknownAccount.data.message, wrongPassword.data.message);
  });

  withDatabase('me 返回当前用户', async () => {
    const { email, token } = await createUser('me');
    const response = await api('/auth/me', { token });

    assert.equal(response.status, 200);
    assert.equal(response.data.user.email, email);
    assert.equal(response.data.user.displayName, 'me');
  });

  withDatabase('缺少令牌与伪造令牌均返回 401', async () => {
    const missing = await api('/workspace/todos');
    assert.equal(missing.status, 401);
    assert.equal(missing.data.error, 'AUTH_REQUIRED');

    const forged = await api('/workspace/todos', { token: 'not-a-real-token' });
    assert.equal(forged.status, 401);
  });

  withDatabase('登出后令牌立即失效，且可以重新登录', async () => {
    const { email, token } = await createUser('logout');

    const logout = await api('/auth/logout', { method: 'POST', token });
    assert.equal(logout.status, 200);
    assert.equal(logout.data.ok, true);

    const afterLogout = await api('/workspace/todos', { token });
    assert.equal(afterLogout.status, 401, '登出后旧令牌必须失效');

    const relogin = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    assert.equal(relogin.status, 200);
  });

  withDatabase('登出只影响当前会话，不影响同一账号的其他会话', async () => {
    const { email, token: first } = await createUser('multi-session');
    const second = (await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } })).data.token;

    await api('/auth/logout', { method: 'POST', token: first });

    assert.equal((await api('/workspace/todos', { token: first })).status, 401);
    assert.equal((await api('/workspace/todos', { token: second })).status, 200, '另一台设备的会话应仍然有效');
  });
});
