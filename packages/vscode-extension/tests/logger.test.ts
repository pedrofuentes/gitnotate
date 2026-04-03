import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, window } from '../__mocks__/vscode';

// We need resetModules because logger.ts uses a module-level singleton.
// Each test imports a fresh module to avoid cross-test state leaks.

describe('Logger', () => {
  beforeEach(() => {
    __reset();
    vi.resetModules();
  });

  describe('createLogger', () => {
    it('creates an output channel named "Gitnotate"', async () => {
      const { createLogger } = await import('../src/logger');
      createLogger();
      expect(window.createOutputChannel).toHaveBeenCalledWith('Gitnotate');
    });
  });

  describe('info', () => {
    it('calls appendLine with correct format', async () => {
      const { createLogger } = await import('../src/logger');
      const logger = createLogger();
      logger.info('TestComponent', 'hello world');

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      expect(appendLine).toHaveBeenCalledTimes(1);

      const output: string = appendLine.mock.calls[0][0];
      expect(output).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\] \[INFO\] \[TestComponent\] hello world$/
      );
    });

    it('formats multiple args separated by spaces', async () => {
      const { createLogger } = await import('../src/logger');
      const logger = createLogger();
      logger.info('Comp', 'a', 42, true);

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      const output: string = appendLine.mock.calls[0][0];
      expect(output).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\] \[INFO\] \[Comp\] a 42 true$/
      );
    });
  });

  describe('warn', () => {
    it('calls appendLine with correct format', async () => {
      const { createLogger } = await import('../src/logger');
      const logger = createLogger();
      logger.warn('SyncService', 'cache miss');

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      expect(appendLine).toHaveBeenCalledTimes(1);

      const output: string = appendLine.mock.calls[0][0];
      expect(output).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\] \[WARN\] \[SyncService\] cache miss$/
      );
    });
  });

  describe('error', () => {
    it('calls appendLine with correct format', async () => {
      const { createLogger } = await import('../src/logger');
      const logger = createLogger();
      logger.error('API', 'request failed', 404);

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      expect(appendLine).toHaveBeenCalledTimes(1);

      const output: string = appendLine.mock.calls[0][0];
      expect(output).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\] \[ERROR\] \[API\] request failed 404$/
      );
    });
  });

  describe('component name', () => {
    it('includes the component name in brackets in the output', async () => {
      const { createLogger } = await import('../src/logger');
      const logger = createLogger();
      logger.info('MyComponent', 'test message');

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      const output: string = appendLine.mock.calls[0][0];
      expect(output).toContain('[MyComponent]');
    });
  });

  describe('getLogger', () => {
    it('returns the singleton logger after createLogger', async () => {
      const { createLogger, getLogger } = await import('../src/logger');
      const logger = createLogger();
      const same = getLogger();
      expect(same).toBe(logger);
    });

    it('throws if called before createLogger', async () => {
      const { getLogger } = await import('../src/logger');
      expect(() => getLogger()).toThrow();
    });
  });

  describe('dispose', () => {
    it('disposes the output channel', async () => {
      const { createLogger } = await import('../src/logger');
      const logger = createLogger();
      logger.dispose();

      const channel = window.createOutputChannel.mock.results[0].value;
      expect(channel.dispose).toHaveBeenCalled();
    });
  });
});
