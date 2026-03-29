import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@gitnotate/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Target: 80% per SENTINEL.md. Baseline: 66.9/74.6/91.1/66.9 (2026-03-29).
      // Ratchet up as tests are added in PRs 2-4, 9.
      thresholds: {
        lines: 65,
        functions: 85,
        branches: 70,
        statements: 65,
      },
    },
  },
});
