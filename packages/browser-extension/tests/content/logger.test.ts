import { describe, it, expect, beforeEach, vi } from 'vitest';
import { debug, resetDebugFlag } from '../../src/content/logger';

// Provide a minimal localStorage mock for jsdom
const localStorageMap = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageMap.set(key, value),
    removeItem: (key: string) => localStorageMap.delete(key),
    clear: () => localStorageMap.clear(),
  },
  writable: true,
  configurable: true,
});

describe('logger', () => {
  beforeEach(() => {
    resetDebugFlag();
    localStorageMap.clear();
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    it('should not log when debug is disabled', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debug('should not appear');

      expect(spy).not.toHaveBeenCalled();
    });

    it('should log when debug is enabled via localStorage', () => {
      localStorageMap.set('gitnotate-debug', 'true');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debug('hello', 42);

      expect(spy).toHaveBeenCalledWith('hello', 42);
    });

    it('should cache the debug flag after first check', () => {
      localStorageMap.set('gitnotate-debug', 'true');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debug('first');
      debug('second');

      expect(spy).toHaveBeenCalledTimes(2);

      // After caching, changing localStorage shouldn't matter
      localStorageMap.delete('gitnotate-debug');
      debug('third');
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('should re-check debug flag after resetDebugFlag()', () => {
      localStorageMap.set('gitnotate-debug', 'true');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debug('first');
      expect(spy).toHaveBeenCalledTimes(1);

      resetDebugFlag();
      localStorageMap.delete('gitnotate-debug');

      debug('second');
      // After reset + removal, debug is now disabled
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should default to disabled when localStorage throws', () => {
      const origGetItem = localStorage.getItem;
      (localStorage as Record<string, unknown>).getItem = () => {
        throw new Error('SecurityError');
      };
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debug('should not appear');

      expect(spy).not.toHaveBeenCalled();
      (localStorage as Record<string, unknown>).getItem = origGetItem;
    });

    it('should treat non-"true" values as disabled', () => {
      localStorageMap.set('gitnotate-debug', 'false');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debug('should not appear');

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
