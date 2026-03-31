import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __getCommentControllers,
  __getCommentThreads,
  CommentMode,
  Uri,
  Range,
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
  });
});
