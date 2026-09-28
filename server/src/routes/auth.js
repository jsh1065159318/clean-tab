import { Hono } from 'hono';
import { query, withTransaction } from '../db.js';
import { env } from '../env.js';
import { badRequest, forbidden, unauthorized } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createSession, destroySession } from '../lib/sessions.js';
import { readObject, readString } from '../lib/validate.js';
import { currentAuth, requireAuth } from '../middleware/auth.js';

export const authRoutes = new Hono();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// 账号不存在时也执行一次真实开销的哈希校验，避免通过响应时间探测邮箱是否已注册。
const DUMMY_PASSWORD_HASH = await hashPassword('clean-tab-timing-equalizer');

const toUser = row => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
});

const readEmail = body => {
  const email = readString(body.email, '邮箱', { trim: true, min: 3, max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw badRequest('email_address_invalid', '邮箱格式不正确，请检查后重试。');
  }
  return email;
};

authRoutes.post('/signup', async c => {
  if (!env.signupEnabled) throw forbidden('当前暂未开放账号注册。');

  const body = readObject(await c.req.json().catch(() => null));
  const email = readEmail(body);
  const password = readString(body.password, '密码', { min: MIN_PASSWORD_LENGTH, max: 200 });
  const displayName = readString(body.displayName ?? '', '昵称', { trim: true, max: 24 });

  const existing = await query('select id from users where email = $1', [email]);
  if (existing.rowCount > 0) {
    throw badRequest('email_exists', '该邮箱已注册，请直接登录。');
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await withTransaction(async client => {
      const inserted = await client.query(
        `insert into users (email, password_hash, display_name)
         values ($1, $2, $3)
         returning id, email, display_name`,
        [email, passwordHash, displayName || email.split('@')[0]],
      );
      await client.query('insert into user_settings (user_id) values ($1)', [inserted.rows[0].id]);
      return inserted.rows[0];
    });
  } catch (error) {
    // 并发注册同一邮箱时由唯一约束兜底。
    if (error?.code === '23505') {
      throw badRequest('email_exists', '该邮箱已注册，请直接登录。');
    }
    throw error;
  }

  const session = await createSession(user.id);
  return c.json({ user: toUser(user), token: session.token, expiresAt: session.expiresAt }, 201);
});

authRoutes.post('/login', async c => {
  const body = readObject(await c.req.json().catch(() => null));
  const email = readEmail(body);
  const password = readString(body.password, '密码', { min: 1, max: 200 });

  const result = await query(
    'select id, email, display_name, password_hash from users where email = $1',
    [email],
  );
  const row = result.rows[0] ?? null;

  const matched = await verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!row || !matched) {
    throw unauthorized('邮箱或密码错误，请检查后重试。');
  }

  const session = await createSession(row.id);
  return c.json({ user: toUser(row), token: session.token, expiresAt: session.expiresAt });
});

authRoutes.get('/me', requireAuth, c => {
  const auth = currentAuth(c);
  return c.json({
    user: { id: auth.userId, email: auth.email, displayName: auth.displayName },
  });
});

authRoutes.post('/logout', requireAuth, async c => {
  await destroySession(currentAuth(c).token);
  return c.json({ ok: true });
});
