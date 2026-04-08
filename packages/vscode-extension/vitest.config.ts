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
      // Baseline after Increment 5: 88%+ lines/stmts, 85%+ branches, 99%+ functions.
      // Gaps are in retry loops, error catch blocks, and deactivate() — low-risk code.
      thresholds: {
        lines: 85,
        functions: 99,
        branches: 85,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, '__mocks__/vscode.ts'),
    },
  },
});
