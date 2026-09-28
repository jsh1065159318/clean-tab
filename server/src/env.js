import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile?.();
} catch {
  // 未提供 .env 时忽略，环境变量由部署环境注入。
}

// server/src/env.js → server/ → 仓库根目录
const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

const readPositiveNumber = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`环境变量 ${name} 必须是正数，当前值为 ${raw}。`);
  }
  return value;
};

const databaseUrl = process.env.DATABASE_URL?.trim() || '';
if (!databaseUrl) {
  throw new Error('缺少必需的环境变量 DATABASE_URL，请参考 server/.env.example 进行配置。');
}

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

export const env = {
  host: process.env.HOST?.trim() || '127.0.0.1',
  port: readPositiveNumber('PORT', 8787),
  databaseUrl,
  databasePoolMax: readPositiveNumber('DB_POOL_MAX', 10),
  sessionDays: readPositiveNumber('SESSION_DAYS', 90),
  signupEnabled: process.env.SIGNUP_ENABLED !== 'false',
  corsOrigins,
  allowAllOrigins: corsOrigins.includes('*'),

  // 落地页静态资源目录。
  publicDir: path.join(serverRoot, 'public'),
  // 扩展构建产物目录，`npm run build` 的输出。供落地页提供下载。
  extensionDir: process.env.EXTENSION_DIR?.trim() || path.join(repositoryRoot, 'build'),
};
