import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './env.js';
import { pool } from './db.js';
import { pruneExpiredSessions } from './lib/sessions.js';

const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const prune = () => {
  pruneExpiredSessions()
    .then(count => {
      if (count > 0) console.log(`已清理 ${count} 条过期会话。`);
    })
    .catch(error => console.error('清理过期会话失败：', error));
};

const server = serve(
  { fetch: app.fetch, hostname: env.host, port: env.port },
  info => {
    console.log(`清爽标签页后端已启动：http://${env.host}:${info.port}`);
    console.log(`账号注册：${env.signupEnabled ? '已开放' : '已关闭'}`);
  },
);

prune();
const pruneTimer = setInterval(prune, PRUNE_INTERVAL_MS);
pruneTimer.unref();

const shutdown = async signal => {
  console.log(`收到 ${signal}，正在关闭服务……`);
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
