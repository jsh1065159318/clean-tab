import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

try {
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('数据库结构已就绪。');
} catch (error) {
  console.error('数据库结构初始化失败：', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
