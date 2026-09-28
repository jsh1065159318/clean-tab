import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { pool } from '../../src/db.js';

const schemaPath = fileURLToPath(new URL('../../src/schema.sql', import.meta.url));

// CI 设置 REQUIRE_DATABASE=1：数据库不可用时直接失败，
// 避免集成测试被静默跳过而 CI 依然显示通过。
const requireDatabase = process.env.REQUIRE_DATABASE === '1';

let available = null;

export const databaseAvailable = async () => {
  if (available !== null) return available;

  try {
    await pool.query('select 1');
    // schema.sql 全部使用 if not exists，可重复执行。
    await pool.query(await readFile(schemaPath, 'utf8'));
    available = true;
  } catch (error) {
    if (requireDatabase) {
      throw new Error(`REQUIRE_DATABASE=1 但数据库不可用：${error.message}`);
    }
    console.warn(`集成测试已跳过：数据库不可用（${error.message}）`);
    available = false;
  }

  return available;
};

// 返回 true 表示当前用例应当跳过。
export const skipWithoutDatabase = async t => {
  if (await databaseAvailable()) return false;
  t.skip('未提供可用的 DATABASE_URL，已跳过集成测试。');
  return true;
};

// 集成测试统一入口：没有数据库时自动跳过，避免每个用例都写一遍守卫。
export const withDatabase = (name, fn) => test(name, async t => {
  if (await skipWithoutDatabase(t)) return;
  await fn(t);
});

export const closeDatabase = () => pool.end();

let counter = 0;

// 用例之间不做清表，改用唯一邮箱隔离，避免并行或重复执行时互相干扰。
export const uniqueEmail = prefix =>
  `${prefix}.${Date.now().toString(36)}.${(counter += 1).toString(36)}@example.test`;
