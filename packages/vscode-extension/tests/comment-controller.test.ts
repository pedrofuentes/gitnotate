import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __getCommentControllers,
  __getCommentThreads,
  CommentMode,
  Uri,
  Range,
  window,
} from '../__mocks__/vscode';
import { CommentController } from '../src/comment-controller';

describe('CommentController', () => {
  beforeEach(() => {
    __reset();
  });

  describe('constructor', () => {
    it('should create a vscode CommentController with correct id and label', () => {
      const controller = new CommentController();

      const controllers = __getCommentControllers();
      expect(controllers).toHaveLength(1);
      expect(controllers[0].id).toBe('gitnotate');
      expect(controllers[0].label).toBe('Gitnotate Sub-line Comments');
      controller.dispose();
    });

    it('should set a commentingRangeProvider on the controller', () => {
      const controller = new CommentController();

      const controllers = __getCommentControllers();
      expect(controllers[0].commentingRangeProvider).toBeDefined();
      controller.dispose();
    });
  });

  describe('commentingRangeProvider', () => {
    it('should return ranges for all non-empty lines in a markdown document', () => {
      const controller = new CommentController();
      const controllers = __getCommentControllers();
      const provider = controllers[0].commentingRangeProvider as {
        provideCommentingRanges: (doc: unknown) => unknown[];
      };

      const doc = {
        languageId: 'markdown',
        lineCount: 4,
        lineAt: (i: number) => {
          const lines = ['# Title', '', 'Some content', '  '];
          return {
            isEmptyOrWhitespace: lines[i].trim().length === 0,
            range: new Range(i, 0, i, lines[i].length),
          };
        },
      };

      const ranges = provider.provideCommentingRanges(doc);
      // Lines 0 and 2 are non-empty; lines 1 and 3 are empty/whitespace
      expect(ranges).toHaveLength(2);

      controller.dispose();
    });

    it('should return empty array for non-markdown documents', () => {
      const controller = new CommentController();
      const controllers = __getCommentControllers();
      const provider = controllers[0].commentingRangeProvider as {
        provideCommentingRanges: (doc: unknown) => unknown[];
      };

      const doc = {
        languageId: 'typescript',
        lineCount: 3,
        lineAt: (i: number) => ({
          isEmptyOrWhitespace: false,
          range: new Range(i, 0, i, 10),
        }),
      };

      const ranges = provider.provideCommentingRanges(doc);
      expect(ranges).toHaveLength(0);

      controller.dispose();
    });
  });

  describe('createThread', () => {
    it('should create a comment thread with the given range and comments', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/docs/readme.md');
      const range = new Range(5, 10, 5, 25);

      controller.createThread(uri, range, [
        { body: 'This is ambiguous', author: 'octocat' },
      ]);

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].uri).toBe(uri);
      expect(threads[0].range).toBe(range);
      expect(threads[0].comments).toHaveLength(1);
      expect(threads[0].comments[0]).toMatchObject({
        body: 'This is ambiguous',
        mode: CommentMode.Preview,
        author: { name: 'octocat' },
      });

      controller.dispose();
    });

    it('should create thread with multiple comments (replies)', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/docs/readme.md');
      const range = new Range(10, 0, 10, 20);

      controller.createThread(uri, range, [
        { body: 'Original comment', author: 'alice' },
        { body: 'Reply to comment', author: 'bob' },
      ]);

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].comments).toHaveLength(2);
      expect(threads[0].comments[1]).toMatchObject({
        body: 'Reply to comment',
        author: { name: 'bob' },
      });

      controller.dispose();
    });
  });

  describe('clearThreads', () => {
    it('should dispose all threads when called without uri', () => {
      const controller = new CommentController();
      const uri1 = Uri.file('/workspace/a.md');
      const uri2 = Uri.file('/workspace/b.md');

      controller.createThread(uri1, new Range(0, 0, 0, 5), [
        { body: 'comment 1', author: 'user' },
      ]);
      controller.createThread(uri2, new Range(0, 0, 0, 5), [
        { body: 'comment 2', author: 'user' },
      ]);

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(2);

      controller.clearThreads();

      // All threads should have been disposed
      expect(threads[0].dispose).toHaveBeenCalled();
      expect(threads[1].dispose).toHaveBeenCalled();

      controller.dispose();
    });

    it('should dispose only threads for the specified uri', () => {
      const controller = new CommentController();
      const uri1 = Uri.file('/workspace/a.md');
      const uri2 = Uri.file('/workspace/b.md');

      controller.createThread(uri1, new Range(0, 0, 0, 5), [
        { body: 'comment 1', author: 'user' },
      ]);
      controller.createThread(uri2, new Range(1, 0, 1, 5), [
        { body: 'comment 2', author: 'user' },
      ]);

      const threads = __getCommentThreads();

      controller.clearThreads(uri1);

      expect(threads[0].dispose).toHaveBeenCalled();
      expect(threads[1].dispose).not.toHaveBeenCalled();

      controller.dispose();
    });
  });

  describe('dispose', () => {
    it('should dispose all threads and the underlying controller', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/a.md');

      controller.createThread(uri, new Range(0, 0, 0, 5), [
        { body: 'comment', author: 'user' },
      ]);

      controller.dispose();

      const threads = __getCommentThreads();
      expect(threads[0].dispose).toHaveBeenCalled();

      const controllers = __getCommentControllers();
      expect(controllers[0].dispose).toHaveBeenCalled();
    });

    it('should dispose the underline decoration types', () => {
      const controller = new CommentController();
      controller.dispose();

      // All 6 color decoration types should be disposed
      expect(window.createTextEditorDecorationType).toHaveBeenCalledTimes(6);
      for (let i = 0; i < 6; i++) {
        const decorationType = window.createTextEditorDecorationType.mock.results[i].value;
        expect(decorationType.dispose).toHaveBeenCalled();
      }
    });
  });

  describe('underline decorations', () => {
    it('should create 6 wavy underline decoration types (one per color)', () => {
      const controller = new CommentController();

      expect(window.createTextEditorDecorationType).toHaveBeenCalledTimes(6);
      for (let i = 0; i < 6; i++) {
        const options = window.createTextEditorDecorationType.mock.calls[i][0];
        expect(options.textDecoration).toContain('underline');
        expect(options.textDecoration).toContain('wavy');
      }

      controller.dispose();
    });

    it('should use distinct colors for each decoration type', () => {
      const controller = new CommentController();

      const colors = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const options = window.createTextEditorDecorationType.mock.calls[i][0];
        colors.add(options.textDecoration);
      }
      expect(colors.size).toBe(6);

      controller.dispose();
    });

    it('should assign different colors to ranges via applyHighlights', () => {
      const controller = new CommentController();
      const mockEditor = {
        setDecorations: vi.fn(),
        document: { uri: Uri.file('/workspace/docs/readme.md') },
      };

      const ranges = [
        new Range(5, 10, 5, 25),
        new Range(5, 30, 5, 45),
        new Range(10, 0, 10, 15),
      ];

      controller.applyHighlights(mockEditor as any, ranges);

      // setDecorations called once per color that has ranges
      // 3 ranges = 3 different colors = 3 calls
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(3);

      controller.dispose();
    });

    it('should cycle colors when more ranges than palette size', () => {
      const controller = new CommentController();
      const mockEditor = {
        setDecorations: vi.fn(),
        document: { uri: Uri.file('/workspace/docs/readme.md') },
      };

      // 7 ranges — should cycle back to color 0
      const ranges = Array.from({ length: 7 }, (_, i) =>
        new Range(i, 0, i, 10)
      );

      controller.applyHighlights(mockEditor as any, ranges);

      // Color 0 gets 2 ranges (index 0 and 6), others get 1
      // So 6 calls to setDecorations (one per color)
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(6);

      controller.dispose();
    });

    it('should clear all highlight colors when clearHighlights is called', () => {
      const controller = new CommentController();
      const mockEditor = {
        setDecorations: vi.fn(),
        document: { uri: Uri.file('/workspace/docs/readme.md') },
      };

      controller.clearHighlights(mockEditor as any);

      // Should clear all 6 decoration types
      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(6);
      for (const call of mockEditor.setDecorations.mock.calls) {
        expect(call[1]).toEqual([]);
      }

      controller.dispose();
    });

    it('should dispose all decoration types on dispose', () => {
      const controller = new CommentController();
      controller.dispose();

      expect(window.createTextEditorDecorationType).toHaveBeenCalledTimes(6);
      for (let i = 0; i < 6; i++) {
        const decorationType = window.createTextEditorDecorationType.mock.results[i].value;
        expect(decorationType.dispose).toHaveBeenCalled();
      }
    });

    it('should return the color index for a range via getColorIndex', () => {
      const controller = new CommentController();

      // First 6 ranges get colors 0-5, 7th wraps to 0
      expect(controller.getColorIndex(0)).toBe(0);
      expect(controller.getColorIndex(1)).toBe(1);
      expect(controller.getColorIndex(5)).toBe(5);
      expect(controller.getColorIndex(6)).toBe(0);

      controller.dispose();
    });

    it('should return the hex color for an index via getColorHex', () => {
      const controller = new CommentController();

      const hex = controller.getColorHex(0);
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);

      controller.dispose();
    });
  });

  describe('revealThread', () => {
    it('should expand the thread at the matching line', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/docs/test.md');

      controller.createThread(
        uri,
        new Range(9, 5, 9, 20),
        [{ body: 'Comment on line 10', author: 'pedro' }]
      );

      const result = controller.revealThread(uri, 10);
      expect(result).toBe(true);

      const threads = __getCommentThreads();
      expect(threads[0].collapsibleState).toBe(1); // Expanded

      controller.dispose();
    });

    it('should return false when no thread matches the line', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/docs/test.md');

      controller.createThread(
        uri,
        new Range(9, 5, 9, 20),
        [{ body: 'Comment on line 10', author: 'pedro' }]
      );

      const result = controller.revealThread(uri, 50);
      expect(result).toBe(false);

      controller.dispose();
    });

    it('should return false when no threads exist for the URI', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/docs/test.md');

      const result = controller.revealThread(uri, 10);
      expect(result).toBe(false);

      controller.dispose();
    });
  });

  describe('onThreadRevealed callback', () => {
    it('should fire callback from revealThread with stored commentId', () => {
      const controller = new CommentController();
      const callback = vi.fn();
      controller.onThreadRevealed = callback;

      const uri = Uri.file('/workspace/docs/test.md');
      controller.createThread(
        uri,
        new Range(9, 5, 9, 20),
        [{ body: 'Comment on line 10', author: 'pedro' }],
        undefined,
        99
      );

      controller.revealThread(uri, 10);

      expect(callback).toHaveBeenCalledWith(99);
      controller.dispose();
    });

    it('should not fire callback from revealThread when no commentId stored', () => {
      const controller = new CommentController();
      const callback = vi.fn();
      controller.onThreadRevealed = callback;

      const uri = Uri.file('/workspace/docs/test.md');
      controller.createThread(
        uri,
        new Range(9, 5, 9, 20),
        [{ body: 'Comment', author: 'user' }]
      );

      controller.revealThread(uri, 10);

      expect(callback).not.toHaveBeenCalled();
      controller.dispose();
    });

    it('should not throw when revealThread fires without callback set', () => {
      const controller = new CommentController();
      const uri = Uri.file('/workspace/docs/test.md');
      controller.createThread(
        uri,
        new Range(9, 5, 9, 20),
        [{ body: 'Comment', author: 'user' }],
        undefined,
        99
      );

      expect(() => controller.revealThread(uri, 10)).not.toThrow();
      controller.dispose();
    });
  });
});
