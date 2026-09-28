import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { query } from '../db.js';

const TOKEN_BYTES = 32;

const hashToken = token => createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + env.sessionDays * 24 * 60 * 60 * 1000);

  await query(
    'insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)',
    [hashToken(token), userId, expiresAt],
  );

  return { token, expiresAt };
}

export async function resolveSession(token) {
  if (typeof token !== 'string' || token.length === 0) return null;

  const result = await query(
    `select s.user_id, u.email, u.display_name
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()`,
    [hashToken(token)],
  );

  const row = result.rows[0];
  if (!row) return null;

  return { userId: row.user_id, email: row.email, displayName: row.display_name };
}

export async function destroySession(token) {
  if (typeof token !== 'string' || token.length === 0) return;
  await query('delete from sessions where token_hash = $1', [hashToken(token)]);
}

export async function destroyUserSessions(userId) {
  await query('delete from sessions where user_id = $1', [userId]);
}

// 定期清理过期会话，避免表无限增长。
export async function pruneExpiredSessions() {
  const result = await query('delete from sessions where expires_at <= now()');
  return result.rowCount;
}
