import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Target: 80% per SENTINEL.md. Baseline: 45.5/93.8/66.7/45.5 (2026-03-29).
      // index.ts (main entrypoint) is untested — needs integration tests.
      thresholds: {
        lines: 45,
        functions: 65,
        branches: 90,
        statements: 45,
      },
    },
  },
});
