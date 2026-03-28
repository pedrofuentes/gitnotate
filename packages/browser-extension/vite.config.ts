import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
      },
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json'),
        );
      },
    },
  ],
  test: {
    passWithNoTests: true,
  },
});
