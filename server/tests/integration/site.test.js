import '../helpers/env.js';

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const fixtureDir = await mkdtemp(path.join(tmpdir(), 'clean-tab-site-'));

const writeManifest = apiOrigin => writeFile(
  path.join(fixtureDir, 'chrome', 'manifest.json'),
  JSON.stringify({ version: '9.9.9', host_permissions: [`${apiOrigin}/*`] }),
);

await mkdir(path.join(fixtureDir, 'chrome', 'icons'), { recursive: true });
await writeFile(path.join(fixtureDir, 'chrome', 'icons', '128x128.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
await writeManifest('https://sync.example.test');
await writeFile(path.join(fixtureDir, 'clean-tab-chrome-9.9.9.zip'), 'chrome-archive');
await writeFile(path.join(fixtureDir, 'clean-tab-firefox-9.9.9.zip'), 'firefox-archive');

// 必须在导入 app 之前设置：env.js 在导入期读取该变量。
process.env.EXTENSION_DIR = fixtureDir;

const { app } = await import('../../src/app.js');
const { closeDatabase } = await import('../helpers/database.js');

after(async () => {
  await closeDatabase();
  await rm(fixtureDir, { recursive: true, force: true });
});

describe('落地页', () => {
  test('返回 HTML 且包含两个浏览器的下载入口', async () => {
    const response = await app.request('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);

    const html = await response.text();
    assert.match(html, /clean-tab-chrome-9\.9\.9\.zip/);
    assert.match(html, /clean-tab-firefox-9\.9\.9\.zip/);
    assert.match(html, /Chrome \/ Edge/);
    assert.match(html, /Firefox/);
  });

  test('模板占位符全部被替换', async () => {
    const html = await (await app.request('/')).text();
    const leftovers = html.match(/\{\{[A-Z_]+\}\}/g);
    assert.equal(leftovers, null, `仍有未替换的占位符：${leftovers}`);
  });

  test('展示版本与安装包已内置的同步后端地址', async () => {
    const html = await (await app.request('/')).text();
    assert.match(html, /9\.9\.9/);
    assert.match(html, /https:\/\/sync\.example\.test/);
  });

  test('转义从 manifest 读到的内容，不原样注入页面', async () => {
    await writeManifest('https://evil.test/"><script>alert(1)</script>');
    const html = await (await app.request('/')).text();

    assert.equal(html.includes('<script>alert(1)</script>'), false, '不得把 manifest 内容原样注入');
    assert.match(html, /&lt;script&gt;/);

    await writeManifest('https://sync.example.test');
  });
});

describe('静态资源与下载', () => {
  test('样式表与图标可访问', async () => {
    const css = await app.request('/landing.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const icon = await app.request('/icon.png');
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get('content-type'), 'image/png');
  });

  test('下载安装包返回 zip 与附件头', async () => {
    const response = await app.request('/downloads/clean-tab-chrome-9.9.9.zip');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/zip');
    assert.match(
      response.headers.get('content-disposition'),
      /attachment; filename="clean-tab-chrome-9\.9\.9\.zip"/,
    );
    assert.equal(await response.text(), 'chrome-archive');
  });

  test('拒绝路径穿越与未识别的文件名', async () => {
    const targets = [
      '/downloads/..%2f..%2fpackage.json',
      '/downloads/package.json',
      '/downloads/chrome%2fmanifest.json',
      '/downloads/clean-tab-safari-9.9.9.zip',
    ];

    for (const target of targets) {
      const response = await app.request(target);
      assert.equal(response.status, 404, `${target} 应返回 404`);
    }
  });

  test('不影响既有 API 路由', async () => {
    const health = await app.request('/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    assert.equal((await app.request('/workspace/todos')).status, 401);
    assert.equal((await app.request('/not-a-route')).status, 404);
  });
});
