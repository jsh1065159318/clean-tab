import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './env.js';
import { pool } from './db.js';
import { buildAccessUrls, isPubliclyBound } from './lib/network.js';
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
  () => {
    const line = '─'.repeat(52);
    console.log('');
    console.log('清爽标签页后端已启动');
    console.log(line);
    console.log('  下载与安装页');
    for (const url of buildAccessUrls()) {
      console.log(`    ${url}`);
    }
    console.log(`  健康检查    http://localhost:${env.port}/health`);
    console.log(line);
    console.log(`  账号注册：${env.signupEnabled ? '已开放' : '已关闭'}`);
    console.log(`  安装包目录：${env.extensionDir}`);
    if (!isPubliclyBound()) {
      console.log('');
      console.log('  当前只监听本机，其他人无法访问上面的地址。');
      console.log('  要分享给他人，请在 server/.env 中设置 HOST=0.0.0.0 后重启。');
    }
    console.log('');
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
