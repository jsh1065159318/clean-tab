import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { env } from './env.js';
import { errorBody } from './lib/http.js';
import { authRoutes } from './routes/auth.js';
import { workspaceRoutes } from './routes/workspace.js';

export const app = new Hono();

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// 浏览器扩展页面的 Origin 形如 chrome-extension://<id>，本地开发则是 http://localhost:<port>。
const isAllowedOrigin = origin => {
  if (env.allowAllOrigins) return true;
  if (env.corsOrigins.includes(origin)) return true;
  if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

app.use('*', bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: c => c.json({ error: 'PAYLOAD_TOO_LARGE', message: '请求体超过 2 MB 上限。' }, 413),
}));

app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin && isAllowedOrigin(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Headers', 'authorization, content-type');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    c.header('Access-Control-Max-Age', '86400');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.get('/health', c => c.json({ ok: true, time: new Date().toISOString() }));

app.route('/auth', authRoutes);
app.route('/workspace', workspaceRoutes);

app.notFound(c => c.json({ error: 'NOT_FOUND', message: '接口不存在。' }, 404));

app.onError((error, c) => {
  const { status, body } = errorBody(error);
  return c.json(body, status);
});
