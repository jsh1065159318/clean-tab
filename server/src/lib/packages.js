import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env.js';

// 下载页展示顺序以此为准。
const BROWSERS = [
  { id: 'chrome', label: 'Chrome / Edge', note: 'Chromium 内核浏览器' },
  { id: 'firefox', label: 'Firefox', note: 'Mozilla Firefox' },
];

// 只接受 `npm run build` 产出的固定命名，其他文件名一律不认。
const PACKAGE_PATTERN = /^clean-tab-(chrome|firefox)-(\d+\.\d+\.\d+)\.zip$/;

export const formatSize = bytes => {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// 从构建产物里的 manifest 反查安装包已内置的同步后端地址。
// 扩展在构建时把 VITE_API_BASE_URL 写进 host_permissions，
// 因此这里读到的就是下载者实际会连的地址，避免页面上写错。
const readManifestInfo = async browserId => {
  try {
    const raw = await readFile(path.join(env.extensionDir, browserId, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
    const first = hostPermissions.find(item => typeof item === 'string');
    return {
      version: typeof manifest.version === 'string' ? manifest.version : null,
      apiOrigin: first ? first.replace(/\/\*$/, '') : null,
    };
  } catch {
    return null;
  }
};

const emptyInfo = () => ({
  available: false,
  version: null,
  apiOrigin: null,
  builtAt: null,
  packages: [],
});

export const readExtensionInfo = async () => {
  let entries;
  try {
    entries = await readdir(env.extensionDir, { withFileTypes: true });
  } catch {
    // 尚未执行过 npm run build。
    return emptyInfo();
  }

  const packages = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = PACKAGE_PATTERN.exec(entry.name);
    if (!match) continue;

    const browser = BROWSERS.find(item => item.id === match[1]);
    const info = await stat(path.join(env.extensionDir, entry.name));
    packages.push({
      browser: match[1],
      label: browser?.label ?? match[1],
      note: browser?.note ?? '',
      file: entry.name,
      declaredVersion: match[2],
      size: info.size,
      sizeText: formatSize(info.size),
      updatedAt: info.mtime.toISOString(),
    });
  }

  packages.sort(
    (left, right) =>
      BROWSERS.findIndex(item => item.id === left.browser) -
      BROWSERS.findIndex(item => item.id === right.browser),
  );

  const manifest = await readManifestInfo('chrome');
  const builtAt = packages.reduce(
    (latest, item) => (!latest || item.updatedAt > latest ? item.updatedAt : latest),
    null,
  );

  return {
    available: packages.length > 0,
    version: manifest?.version ?? packages[0]?.declaredVersion ?? null,
    apiOrigin: manifest?.apiOrigin ?? null,
    builtAt,
    packages,
  };
};

// 按扫描结果精确匹配，不接受任何未经识别的文件名，从根本上排除路径穿越。
export const findPackage = async fileName => {
  if (typeof fileName !== 'string' || !PACKAGE_PATTERN.test(fileName)) return null;
  const info = await readExtensionInfo();
  const found = info.packages.find(item => item.file === fileName);
  return found ? { ...found, path: path.join(env.extensionDir, fileName) } : null;
};

export const resolveIconPath = async () => {
  const candidate = path.join(env.extensionDir, 'chrome', 'icons', '128x128.png');
  try {
    await stat(candidate);
    return candidate;
  } catch {
    return null;
  }
};
