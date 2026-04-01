// @ts-check
const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/integration-tests/**/*.test.js',
  workspaceFolder: './integration-tests/fixtures',
  mocha: {
    timeout: 30000,
  },
  // Don't install other extensions to avoid interference
  launchArgs: ['--disable-extensions'],
});
