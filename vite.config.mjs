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
 * - `bun run build` - Production build for all browsers
 * - `bun run dev` - Development server with HMR
 */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';
import ADMZip from 'adm-zip';
import * as pkg from './package.json';
import progress from 'vite-plugin-progress';

const isProd = process.env.NODE_ENV === 'production';

const prepareBuilds = () => ({
  name: 'prepareBuilds',
  closeBundle() {
    if (isProd) {
      console.log('Building extension packages...');

      // Ensure base directories exist
      fs.mkdirSync(path.resolve(__dirname, './build'), { recursive: true });
      fs.mkdirSync(path.resolve(__dirname, './dist'), { recursive: true });

      // Copy assets to dist for proper bundling
      const distAssetsPath = path.resolve(__dirname, './dist/src/assets');
      fs.mkdirSync(distAssetsPath, { recursive: true });
      fs.cpSync(path.resolve(__dirname, './src/assets'), distAssetsPath, { recursive: true });

      // Chrome Build
      console.log('Building Chrome extension...');
      const chromeBuildPath = path.resolve(__dirname, './build/chrome');
      fs.mkdirSync(chromeBuildPath, { recursive: true });

      // Copy manifest and background script
      fs.copyFileSync(
        path.resolve(__dirname, './manifest/chrome.json'),
        path.resolve(chromeBuildPath, 'manifest.json'),
      );
      fs.copyFileSync(
        path.resolve(__dirname, './manifest/background.js'),
        path.resolve(chromeBuildPath, 'background.js'),
      );

      // Copy dist (bundled app)
      fs.cpSync(path.resolve(__dirname, './dist'), chromeBuildPath, { recursive: true });

      // Copy extension icons (separate from bundled assets)
      fs.cpSync(
        path.resolve(__dirname, './src/assets/icons'),
        path.resolve(chromeBuildPath, 'icons'),
        { recursive: true },
      );

      // Firefox Build
      console.log('Building Firefox extension...');
      const firefoxBuildPath = path.resolve(__dirname, './build/firefox');
      fs.mkdirSync(firefoxBuildPath, { recursive: true });

      // Copy manifest and background script
      fs.copyFileSync(
        path.resolve(__dirname, './manifest/firefox.json'),
        path.resolve(firefoxBuildPath, 'manifest.json'),
      );
      fs.copyFileSync(
        path.resolve(__dirname, './manifest/background.js'),
        path.resolve(firefoxBuildPath, 'background.js'),
      );

      // Copy dist (bundled app)
      fs.cpSync(path.resolve(__dirname, './dist'), firefoxBuildPath, { recursive: true });

      // Copy extension icons (separate from bundled assets)
      fs.cpSync(
        path.resolve(__dirname, './src/assets/icons'),
        path.resolve(firefoxBuildPath, 'icons'),
        { recursive: true },
      );

      // Create distribution zips
      console.log('Creating distribution packages...');
      const chromeZip = new ADMZip();
      chromeZip.addLocalFolder(chromeBuildPath);
      chromeZip.writeZip(path.resolve(__dirname, `./build/clean-tab-chrome-${pkg.version}.zip`));
      console.log(`Chrome: clean-tab-chrome-${pkg.version}.zip`);

      const firefoxZip = new ADMZip();
      firefoxZip.addLocalFolder(firefoxBuildPath);
      firefoxZip.writeZip(path.resolve(__dirname, `./build/clean-tab-firefox-${pkg.version}.zip`));
      console.log(`Firefox: clean-tab-firefox-${pkg.version}.zip`);

      console.log('Build complete.');
    }
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: { __APP_ENV__: JSON.stringify(env.APP_ENV) },
    plugins: [react(), prepareBuilds(), progress()],
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
      extensions: ['.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        i18n: path.resolve(__dirname, './src/i18n'),
        components: path.resolve(__dirname, './src/components'),
        contexts: path.resolve(__dirname, './src/contexts'),
        assets: path.resolve(__dirname, './src/assets'),
        config: path.resolve(__dirname, './src/config'),
        features: path.resolve(__dirname, './src/features'),
        lib: path.resolve(__dirname, './src/lib'),
        scss: path.resolve(__dirname, './src/scss'),
        services: path.resolve(__dirname, './src/services'),
        stores: path.resolve(__dirname, './src/stores'),
        translations: path.resolve(__dirname, './src/i18n/locales'),
        utils: path.resolve(__dirname, './src/utils'),
      },
    },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  };
});
