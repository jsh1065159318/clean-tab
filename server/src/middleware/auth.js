import { unauthorized, readBearerToken } from '../lib/http.js';
import { resolveSession } from '../lib/sessions.js';

// 身份完全由会话令牌推导，请求体或查询参数中的 user_id 一律忽略。
export const requireAuth = async (c, next) => {
  const token = readBearerToken(c.req.header('authorization'));
  if (!token) throw unauthorized('缺少登录令牌。');

  const session = await resolveSession(token);
  if (!session) throw unauthorized();

  c.set('auth', { ...session, token });
  await next();
};

export const currentAuth = c => {
  const auth = c.get('auth');
  if (!auth) throw unauthorized();
  return auth;
};
