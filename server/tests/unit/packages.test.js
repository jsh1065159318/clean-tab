import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const fixtureDir = await mkdtemp(path.join(tmpdir(), 'clean-tab-packages-'));

// 必须在导入被测模块之前设置：env.js 在导入期读取这两个变量。
process.env.DATABASE_URL ||= 'postgres://unused:unused@127.0.0.1:1/unused';
process.env.EXTENSION_DIR = fixtureDir;

const { findPackage, formatSize, readExtensionInfo } = await import('../../src/lib/packages.js');

const writeFixture = async () => {
  await mkdir(path.join(fixtureDir, 'chrome', 'icons'), { recursive: true });
  await writeFile(
    path.join(fixtureDir, 'chrome', 'manifest.json'),
    JSON.stringify({ version: '9.9.9', host_permissions: ['https://sync.example.test/*'] }),
  );
  await writeFile(path.join(fixtureDir, 'chrome', 'icons', '128x128.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(path.join(fixtureDir, 'clean-tab-chrome-9.9.9.zip'), 'chrome-archive');
  await writeFile(path.join(fixtureDir, 'clean-tab-firefox-9.9.9.zip'), 'firefox-archive');
};

test('formatSize 覆盖各量级并拒绝非法输入', () => {
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(2048), '2.0 KB');
  assert.equal(formatSize(1536 * 1024), '1.50 MB');
  assert.equal(formatSize(-1), '未知');
  assert.equal(formatSize(Number.NaN), '未知');
});

test('构建目录为空时报告不可用，而不是抛错', async () => {
  const info = await readExtensionInfo();
  assert.equal(info.available, false);
  assert.deepEqual(info.packages, []);
  assert.equal(info.version, null);
  assert.equal(info.apiOrigin, null);
});

test('识别安装包并从 manifest 反查版本与同步后端地址', async () => {
  await writeFixture();
  const info = await readExtensionInfo();

  assert.equal(info.available, true);
  assert.equal(info.version, '9.9.9');
  assert.equal(info.apiOrigin, 'https://sync.example.test', 'host_permissions 的 /* 后缀应被去掉');
  assert.equal(info.packages.length, 2);
  assert.deepEqual(info.packages.map(item => item.browser), ['chrome', 'firefox'], '顺序应稳定');
  assert.equal(info.packages[0].label, 'Chrome / Edge');
  assert.ok(info.packages[0].sizeText.endsWith('B'));
  assert.ok(Date.parse(info.builtAt) > 0);
});

test('忽略命名不符合约定的文件', async () => {
  await writeFile(path.join(fixtureDir, 'clean-tab-chrome-latest.zip'), 'x');
  await writeFile(path.join(fixtureDir, 'other-chrome-1.0.0.zip'), 'x');
  await writeFile(path.join(fixtureDir, 'clean-tab-chrome-9.9.9.zip.sha256'), 'x');

  const info = await readExtensionInfo();
  assert.equal(info.packages.length, 2, '只有严格符合 clean-tab-<browser>-<x.y.z>.zip 的文件才算安装包');
});

test('findPackage 只接受扫描结果中的确切文件名', async () => {
  const found = await findPackage('clean-tab-chrome-9.9.9.zip');
  assert.ok(found);
  assert.equal(found.browser, 'chrome');
  assert.ok(found.path.endsWith('clean-tab-chrome-9.9.9.zip'));
});

test('findPackage 拒绝路径穿越与任意文件名', async () => {
  const rejected = [
    '../package.json',
    '../../etc/passwd',
    '..%2f..%2fpackage.json',
    'chrome/manifest.json',
    'clean-tab-chrome-9.9.9.zip/../../package.json',
    '',
    null,
    undefined,
    42,
  ];

  for (const name of rejected) {
    assert.equal(await findPackage(name), null, `不应接受 ${String(name)}`);
  }
});

test('findPackage 对未构建的浏览器返回 null', async () => {
  assert.equal(await findPackage('clean-tab-safari-9.9.9.zip'), null);
});
