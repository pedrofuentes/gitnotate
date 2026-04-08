import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, window } from '../__mocks__/vscode';
import { createLogger, getLogger, _resetForTesting } from '../src/logger';

describe('Logger', () => {
  beforeEach(() => {
    __reset();
    _resetForTesting();
  });

  describe('createLogger', () => {
    it('creates an output channel named "Gitnotate"', () => {
      createLogger();
      expect(window.createOutputChannel).toHaveBeenCalledWith('Gitnotate');
    });
  });

  describe('info', () => {
    it('calls appendLine with correct format', () => {
      const logger = createLogger();
      logger.info('TestComponent', 'hello world');

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      expect(appendLine).toHaveBeenCalledTimes(1);

      const output: string = appendLine.mock.calls[0][0];
      expect(output).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\] \[INFO\] \[TestComponent\] hello world$/
      );
    });

    it('formats multiple args separated by spaces', () => {
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
    it('calls appendLine with correct format', () => {
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
    it('calls appendLine with correct format', () => {
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
    it('includes the component name in brackets in the output', () => {
      const logger = createLogger();
      logger.info('MyComponent', 'test message');

      const appendLine = window.createOutputChannel.mock.results[0].value.appendLine;
      const output: string = appendLine.mock.calls[0][0];
      expect(output).toContain('[MyComponent]');
    });
  });

  describe('getLogger', () => {
    it('returns the singleton logger after createLogger', () => {
      const logger = createLogger();
      const same = getLogger();
      expect(same).toBe(logger);
    });

    it('throws if called before createLogger', () => {
      expect(() => getLogger()).toThrow();
    });
  });

  describe('dispose', () => {
    it('disposes the output channel', () => {
      const logger = createLogger();
      logger.dispose();

      const channel = window.createOutputChannel.mock.results[0].value;
      expect(channel.dispose).toHaveBeenCalled();
    });
  });
});
