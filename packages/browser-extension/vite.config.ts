import { defineConfig } from 'vite';
import { resolve } from 'path';

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
      },
    },
  },
  test: {
    passWithNoTests: true,
  },
});
