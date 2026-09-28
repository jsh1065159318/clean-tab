try {
  process.loadEnvFile?.();
} catch {
  // 未提供 .env 时忽略，环境变量由部署环境注入。
}

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
};
