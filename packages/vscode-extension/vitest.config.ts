import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Target: 80% per SENTINEL.md. Current baseline established 2026-03-29.
      thresholds: {
        lines: 90,
        functions: 100,
        branches: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, '__mocks__/vscode.ts'),
    },
  },
});
