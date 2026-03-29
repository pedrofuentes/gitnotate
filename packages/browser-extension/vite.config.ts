import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, writeFileSync, readFileSync, cpSync, mkdirSync } from 'fs';
import { build } from 'vite';

// We need two separate builds:
// 1. Content script + service worker: must be self-contained IIFE (no imports)
// 2. Popup: can use ES modules (loaded via HTML with type="module")
//
// Vite doesn't support mixed formats in a single build, so we use a plugin
// to run a second build for the content script after the main build.

export default defineConfig({
  // Main build: popup only (ES modules are fine here)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome110',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    {
      name: 'build-content-scripts',
      async closeBundle() {
        // Copy manifest
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json'),
        );

        // Copy icons
        const iconsSrc = resolve(__dirname, 'icons');
        const iconsDest = resolve(__dirname, 'dist/icons');
        mkdirSync(iconsDest, { recursive: true });
        for (const icon of ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png']) {
          copyFileSync(resolve(iconsSrc, icon), resolve(iconsDest, icon));
        }

        // Build content script as IIFE (self-contained, no imports)
        await build({
          configFile: false,
          build: {
            outDir: resolve(__dirname, 'dist'),
            emptyOutDir: false,
            target: 'chrome110',
            lib: {
              entry: resolve(__dirname, 'src/content/index.ts'),
              formats: ['iife'],
              name: 'GitnotateContent',
              fileName: () => 'content.js',
            },
            rollupOptions: {
              output: {
                assetFileNames: 'assets/[name][extname]',
              },
            },
          },
        });

        // Build service worker as IIFE
        await build({
          configFile: false,
          build: {
            outDir: resolve(__dirname, 'dist'),
            emptyOutDir: false,
            target: 'chrome110',
            lib: {
              entry: resolve(__dirname, 'src/background/service-worker.ts'),
              formats: ['iife'],
              name: 'GitnotateServiceWorker',
              fileName: () => 'service-worker.js',
            },
          },
        });
      },
    },
  ],
  test: {
    passWithNoTests: true,
  },
});
