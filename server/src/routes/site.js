import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { env } from '../env.js';
import { notFound } from '../lib/http.js';
import { buildAccessUrls, isPubliclyBound } from '../lib/network.js';
import { findPackage, readExtensionInfo, resolveIconPath } from '../lib/packages.js';

export const siteRoutes = new Hono();

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderPackages = info => {
  if (!info.available) {
    return `<div class="notice notice-warn">
        <strong>尚未生成安装包</strong>
        <p>在项目根目录执行 <code>npm run build</code> 后刷新本页即可下载。</p>
      </div>`;
  }

  return `<div class="downloads">${info.packages.map(item => `
        <a class="download-card" href="/downloads/${encodeURIComponent(item.file)}" download>
          <span class="download-label">${escapeHtml(item.label)}</span>
          <span class="download-note">${escapeHtml(item.note)}</span>
          <span class="download-size">${escapeHtml(item.sizeText)}</span>
          <span class="download-action">下载安装包</span>
        </a>`).join('')}
      </div>`;
};

const renderSyncHint = info => {
  if (info.apiOrigin) {
    return `<p>此安装包已内置同步后端地址 <code>${escapeHtml(info.apiOrigin)}</code>。
          安装后注册账号即可在多设备之间同步。若该地址在你的网络下不可达，扩展会自动以本地模式继续工作，不影响任何核心功能。</p>`;
  }
  return `<p>此安装包<strong>未内置同步后端地址</strong>，安装后以纯本地模式运行：
          搜索、快捷方式、任务、笔记、专注与全部工具都可以正常使用，只是没有多设备同步。</p>`;
};

const renderShare = () => {
  const urls = buildAccessUrls();
  const items = urls.map(url => `<li><code>${escapeHtml(url)}</code></li>`).join('');
  const hint = isPubliclyBound()
    ? '<p>把下面的地址发给他人，即可下载安装包。</p>'
    : '<p>当前服务只监听本机回环地址，局域网内的其他人无法访问。'
      + '若要分享，请在 <code>server/.env</code> 中设置 <code>HOST=0.0.0.0</code> 后重启服务。</p>';

  return `${hint}<ul class="share-list">${items}</ul>`;
};

const renderBuiltAt = info => {
  if (!info.builtAt) return '尚未构建';
  const date = new Date(info.builtAt);
  if (Number.isNaN(date.getTime())) return '尚未构建';
  return date.toLocaleString('zh-CN', { hour12: false });
};

siteRoutes.get('/', async c => {
  const [template, info] = await Promise.all([
    readFile(path.join(env.publicDir, 'index.html'), 'utf8'),
    readExtensionInfo(),
  ]);

  const iconPath = await resolveIconPath();
  const html = template
    .replaceAll('{{VERSION}}', escapeHtml(info.version ?? '开发版'))
    .replaceAll('{{BUILT_AT}}', escapeHtml(renderBuiltAt(info)))
    .replaceAll('{{PACKAGES}}', renderPackages(info))
    .replaceAll('{{SYNC_HINT}}', renderSyncHint(info))
    .replaceAll('{{SHARE}}', renderShare())
    .replaceAll('{{ICON}}', iconPath ? '/icon.png' : 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');

  return c.html(html);
});

siteRoutes.get('/icon.png', async c => {
  const iconPath = await resolveIconPath();
  if (!iconPath) throw notFound('图标不存在，请先执行 npm run build。');

  const data = await readFile(iconPath);
  c.header('Content-Type', 'image/png');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(data);
});

siteRoutes.get('/landing.css', async c => {
  const css = await readFile(path.join(env.publicDir, 'landing.css'), 'utf8');
  c.header('Content-Type', 'text/css; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=300');
  return c.body(css);
});

siteRoutes.get('/downloads/:file', async c => {
  const found = await findPackage(c.req.param('file'));
  if (!found) throw notFound('安装包不存在，请确认已执行 npm run build。');

  // 扩展包体积在数百 KB 量级，直接读入内存比流式处理更少出错。
  const data = await readFile(found.path);
  c.header('Content-Type', 'application/zip');
  c.header('Content-Length', String(data.byteLength));
  c.header('Content-Disposition', `attachment; filename="${found.file}"`);
  c.header('Cache-Control', 'no-cache');
  return c.body(data);
});
