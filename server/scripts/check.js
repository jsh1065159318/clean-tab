// 零依赖语法检查：对 src/ 下每个 .js 文件执行 `node --check`。
// 测试只覆盖被导入的模块，index.js 与 migrate.js 不会被测试加载，
// 这里补上语法层面的兜底，避免它们带着语法错误进入部署。
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));

const collect = directory => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(fullPath));
    else if (entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
};

const files = collect(sourceRoot).sort();
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failed += 1;
    console.error(`语法错误：${file}`);
    console.error(error.stderr?.toString().trim() ?? error.message);
  }
}

if (failed > 0) {
  console.error(`\n检查 ${files.length} 个文件，其中 ${failed} 个存在语法错误。`);
  process.exit(1);
}

console.log(`语法检查通过：${files.length} 个文件。`);
