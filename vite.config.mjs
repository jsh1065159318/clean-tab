/**
 * Vite configuration for the Clean Tab browser extension.
 *
 * This configuration handles building the extension for multiple browsers:
 * - Chrome/Edge (Manifest V3)
 * - Firefox (Manifest V3)
 *
 * Build Process:
 * 1. Vite bundles the React app into /dist
 * 2. Assets are copied to dist/src/assets for proper path resolution
 * 3. Browser-specific builds are created in /build/{browser}
 * 4. Distribution .zip files are generated for Chrome and Firefox
 *
 * Build Commands:
 * - `npm run build` - Production build for all browsers
 * - `npm run dev` - Development server with HMR
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';
import ADMZip from 'adm-zip';
import * as pkg from './package.json';
import progress from 'vite-plugin-progress';
import { fileURLToPath } from 'url';
import { brotliCompressSync, gzipSync } from 'zlib';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const resolveRoot = (...segments) => path.resolve(rootDir, ...segments);
const extensionIconFiles = ['16x16.png', '32x32.png', '48x48.png', '128x128.png'];
const KIB = 1024;

const performanceBudget = () => ({
  name: 'performanceBudget',
  generateBundle(_options, bundle) {
    const entries = Object.values(bundle).filter(output => output.type === 'chunk' && output.isEntry);
    const entryFiles = new Set();
    const addStaticImports = (fileName) => {
      if (entryFiles.has(fileName)) return;
      const output = bundle[fileName];
      if (!output || output.type !== 'chunk') return;
      entryFiles.add(fileName);
      output.imports.forEach(addStaticImports);
    };
    entries.forEach(entry => addStaticImports(entry.fileName));

    const rows = Object.values(bundle)
      .filter(output => output.type === 'chunk' || /\.css$/i.test(output.fileName))
      .map(output => {
        const source = output.type === 'chunk' ? output.code : String(output.source);
        return {
          file: output.fileName,
          raw: Buffer.byteLength(source),
          gzip: gzipSync(source).byteLength,
          brotli: brotliCompressSync(source).byteLength,
          initial: output.type === 'chunk' && entryFiles.has(output.fileName),
        };
      });

    console.table(rows.map(row => ({
      asset: row.file,
      load: row.initial ? 'initial' : 'lazy',
      rawKiB: (row.raw / KIB).toFixed(1),
      gzipKiB: (row.gzip / KIB).toFixed(1),
      brotliKiB: (row.brotli / KIB).toFixed(1),
    })));

    const initialJsGzip = rows
      .filter(row => row.initial && row.file.endsWith('.js'))
      .reduce((total, row) => total + row.gzip, 0);
    const cssGzip = rows
      .filter(row => row.file.endsWith('.css'))
      .reduce((total, row) => total + row.gzip, 0);
    if (initialJsGzip > 150 * KIB) {
      throw new Error(`Initial JavaScript exceeds 150 KiB gzip: ${(initialJsGzip / KIB).toFixed(1)} KiB`);
    }
    if (cssGzip > 30 * KIB) {
      throw new Error(`CSS exceeds 30 KiB gzip: ${(cssGzip / KIB).toFixed(1)} KiB`);
    }
  },
});

const copyIconFiles = (targetDir, files) => {
  fs.mkdirSync(targetDir, { recursive: true });
  files.forEach((file) => {
    fs.copyFileSync(resolveRoot('src/assets/icons', file), path.resolve(targetDir, file));
  });
};

const writeBuildManifest = (sourceFile, targetFile) => {
  const manifest = JSON.parse(fs.readFileSync(resolveRoot(sourceFile), 'utf8'));
  manifest.version = pkg.version;
  const configuredUrl = process.env.VITE_API_BASE_URL?.trim();
  if (configuredUrl) {
    const origin = new URL(configuredUrl).origin;
    // 同步改为轮询后不再建立 WebSocket，connect-src 只需放行 API 域名本身。
    manifest.host_permissions = [`${origin}/*`];
    manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'self'; connect-src 'self' ${origin};`;
  } else {
    delete manifest.host_permissions;
    manifest.content_security_policy.extension_pages = "script-src 'self'; object-src 'self'; connect-src 'self';";
  }
  fs.writeFileSync(targetFile, `${JSON.stringify(manifest, null, 2)}\n`);
};

const validateExtensionBuild = (buildPath, zipPath) => {
  const requiredFiles = ['manifest.json', 'background.js', 'index.html', 'icons/16x16.png', 'icons/48x48.png', 'icons/128x128.png'];
  requiredFiles.forEach(file => {
    if (!fs.existsSync(path.resolve(buildPath, file))) throw new Error(`Extension build is missing ${file}`);
  });
  const manifest = JSON.parse(fs.readFileSync(path.resolve(buildPath, 'manifest.json'), 'utf8'));
  if (manifest.version !== pkg.version) throw new Error(`Manifest version ${manifest.version} does not match package ${pkg.version}`);

  const forbiddenFiles = [];
  const secretHits = [];
  const secretPattern = /SUPABASE_SERVICE_ROLE_KEY|service[_-]?role[_-]?key|sk_live_[a-z0-9]+|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i;
  const scan = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const absolute = path.resolve(directory, entry.name);
    if (entry.isDirectory()) scan(absolute);
    else {
      const relative = path.relative(buildPath, absolute);
      if (/\.map$|(^|\/)\.env|\.(test|spec)\.[cm]?[jt]sx?$/i.test(relative)) forbiddenFiles.push(absolute);
      if (/\.(?:css|html|js|json)$/i.test(relative) && secretPattern.test(fs.readFileSync(absolute, 'utf8'))) secretHits.push(relative);
    }
  });
  scan(buildPath);
  if (forbiddenFiles.length > 0) throw new Error(`Forbidden release files: ${forbiddenFiles.join(', ')}`);
  if (secretHits.length > 0) throw new Error(`Potential secret found in release files: ${secretHits.join(', ')}`);

  const archive = new ADMZip(zipPath);
  if (!archive.getEntry('manifest.json') || archive.getEntries().length < requiredFiles.length) {
    throw new Error(`Extension archive is incomplete: ${zipPath}`);
  }
};

const prepareBuilds = isProd => ({
  name: 'prepareBuilds',
  closeBundle() {
    if (isProd) {
      console.log('Building extension packages...');

      // Ensure base directories exist
      fs.mkdirSync(resolveRoot('build'), { recursive: true });
      fs.mkdirSync(resolveRoot('dist'), { recursive: true });

      // Chrome Build
      console.log('Building Chrome extension...');
      const chromeBuildPath = resolveRoot('build/chrome');
      fs.rmSync(chromeBuildPath, { recursive: true, force: true });
      fs.mkdirSync(chromeBuildPath, { recursive: true });

      // Copy manifest and background script
      writeBuildManifest('manifest/chrome.json', path.resolve(chromeBuildPath, 'manifest.json'));
      fs.copyFileSync(
        resolveRoot('manifest/background.js'),
        path.resolve(chromeBuildPath, 'background.js'),
      );

      // Copy dist (bundled app)
      fs.cpSync(resolveRoot('dist'), chromeBuildPath, { recursive: true });

      copyIconFiles(path.resolve(chromeBuildPath, 'icons'), extensionIconFiles);

      // Firefox Build
      console.log('Building Firefox extension...');
      const firefoxBuildPath = resolveRoot('build/firefox');
      fs.rmSync(firefoxBuildPath, { recursive: true, force: true });
      fs.mkdirSync(firefoxBuildPath, { recursive: true });

      // Copy manifest and background script
      writeBuildManifest('manifest/firefox.json', path.resolve(firefoxBuildPath, 'manifest.json'));
      fs.copyFileSync(
        resolveRoot('manifest/background.js'),
        path.resolve(firefoxBuildPath, 'background.js'),
      );

      // Copy dist (bundled app)
      fs.cpSync(resolveRoot('dist'), firefoxBuildPath, { recursive: true });

      copyIconFiles(path.resolve(firefoxBuildPath, 'icons'), extensionIconFiles);

      // Create distribution zips
      console.log('Creating distribution packages...');
      const chromeZip = new ADMZip();
      chromeZip.addLocalFolder(chromeBuildPath);
      const chromeZipPath = resolveRoot(`build/clean-tab-chrome-${pkg.version}.zip`);
      chromeZip.writeZip(chromeZipPath);
      console.log(`Chrome: clean-tab-chrome-${pkg.version}.zip`);

      const firefoxZip = new ADMZip();
      firefoxZip.addLocalFolder(firefoxBuildPath);
      const firefoxZipPath = resolveRoot(`build/clean-tab-firefox-${pkg.version}.zip`);
      firefoxZip.writeZip(firefoxZipPath);
      console.log(`Firefox: clean-tab-firefox-${pkg.version}.zip`);

      validateExtensionBuild(chromeBuildPath, chromeZipPath);
      validateExtensionBuild(firefoxBuildPath, firefoxZipPath);
      console.log('Extension manifests and archives validated.');

      console.log('Build complete.');
    }
  },
});

export default defineConfig(({ command }) => {
  const isProd = command === 'build';
  return {
    plugins: [react(), performanceBudget(), prepareBuilds(isProd), progress()],
    server: { open: true, hmr: { protocol: 'ws', host: 'localhost' } },
    build: {
      target: 'esnext', // Use modern JavaScript features
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
      rollupOptions: {
        output: {
          manualChunks: undefined, // Let Vite handle chunking automatically to avoid circular dependency issues
        },
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      alias: {
        '@': resolveRoot('src'),
        assets: resolveRoot('src/assets'),
        constants: resolveRoot('src/constants'),
        config: resolveRoot('src/config'),
        features: resolveRoot('src/features'),
        lib: resolveRoot('src/lib'),
        repositories: resolveRoot('src/repositories'),
        services: resolveRoot('src/services'),
        utils: resolveRoot('src/utils'),
      },
    },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  };
});
