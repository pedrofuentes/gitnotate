import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHighlightStyle,
  setHighlightStyle,
  applyHighlightStyle,
} from '../../src/storage/highlight-style.js';
import type { HighlightStyle } from '../../src/storage/highlight-style.js';

let store: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys: string[] | null) => {
        if (keys === null) {
          return Promise.resolve({ ...store });
        }
        return Promise.resolve(
          Object.fromEntries(
            keys.filter((k) => k in store).map((k) => [k, store[k]])
          )
        );
      },
      set: (items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      },
    },
  },
} as unknown as typeof chrome;

beforeEach(() => {
  store = {};
  document.body.removeAttribute('data-gn-style');
});

describe('highlight-style', () => {
  describe('getHighlightStyle', () => {
    it('should return default style (dashed) when nothing is stored', async () => {
      const style = await getHighlightStyle();
      expect(style).toBe('dashed');
    });

    it('should return stored style when set', async () => {
      store['gitnotate-highlight-style'] = 'underline';
      const style = await getHighlightStyle();
      expect(style).toBe('underline');
    });

    it('should return stored background style', async () => {
      store['gitnotate-highlight-style'] = 'background';
      const style = await getHighlightStyle();
      expect(style).toBe('background');
    });

    it('should return default style when storage throws', async () => {
      const originalGet = chrome.storage.local.get;
      (chrome.storage.local as Record<string, unknown>).get = () => {
        throw new Error('storage error');
      };

      const style = await getHighlightStyle();
      expect(style).toBe('dashed');

      (chrome.storage.local as Record<string, unknown>).get = originalGet;
    });
  });

  describe('setHighlightStyle', () => {
    it('should persist style to storage', async () => {
      await setHighlightStyle('underline');
      expect(store['gitnotate-highlight-style']).toBe('underline');
    });

    it('should overwrite existing style', async () => {
      await setHighlightStyle('underline');
      await setHighlightStyle('background');
      expect(store['gitnotate-highlight-style']).toBe('background');
    });
  });

  describe('applyHighlightStyle', () => {
    it('should set data-gn-style attribute on document body', () => {
      applyHighlightStyle('dashed');
      expect(document.body.getAttribute('data-gn-style')).toBe('dashed');
    });

    it('should update attribute when called with different style', () => {
      applyHighlightStyle('dashed');
      applyHighlightStyle('underline');
      expect(document.body.getAttribute('data-gn-style')).toBe('underline');
    });

    it('should set background style', () => {
      applyHighlightStyle('background');
      expect(document.body.getAttribute('data-gn-style')).toBe('background');
    });
  });
});
