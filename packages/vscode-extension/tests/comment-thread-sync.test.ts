import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __getCommentThreads, Uri, Range } from '../__mocks__/vscode';
import { CommentThreadSync } from '../src/comment-thread-sync';
import { CommentController } from '../src/comment-controller';
import type { PrService, PullRequestInfo, ReviewComment } from '../src/pr-service';

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 1,
    body: '^gn:10:R:5:15\n> 📌 **"some text"** (chars 5–15)\n\nLooks good',
    path: 'docs/readme.md',
    line: 10,
    side: 'RIGHT',
    inReplyToId: undefined,
    userLogin: 'octocat',
    createdAt: '2026-03-29T10:00:00Z',
    updatedAt: '2026-03-29T10:00:00Z',
    ...overrides,
  };
}

function makePr(): PullRequestInfo {
  return { owner: 'owner', repo: 'repo', number: 42, headSha: 'abc123' };
}

function makeMockPrService(comments: ReviewComment[] = []): PrService {
  return {
    listReviewComments: vi.fn().mockResolvedValue(comments),
    createReviewComment: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as PrService;
}

describe('CommentThreadSync', () => {
  let commentController: CommentController;

  beforeEach(() => {
    __reset();
    commentController = new CommentController();
  });

  describe('syncForDocument', () => {
    it('should fetch comments and create threads for ^gn comments matching the file', async () => {
      const comment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n> 📌 **"some text"** (chars 5–15)\n\nLooks good',
        path: 'docs/readme.md',
        line: 10,
      });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(1);
      // ^gn:10:R:5:15 → line 9 (0-indexed), chars 5-15
      expect(threads[0].range).toEqual(new Range(9, 5, 9, 15));
      expect(threads[0].comments).toHaveLength(1);
      expect(threads[0].comments[0]).toMatchObject({
        body: 'Looks good',
        author: { name: 'octocat' },
      });
    });

    it('should show non-^gn comments as full-line threads without underline', async () => {
      const comment = makeComment({
        id: 2,
        body: 'This is a regular line comment without gn metadata',
        path: 'docs/readme.md',
        line: 5,
      });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      const highlightRanges = await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].range).toEqual(new Range(4, Number.MAX_SAFE_INTEGER, 4, Number.MAX_SAFE_INTEGER));
      expect(threads[0].comments[0]).toMatchObject({
        body: 'This is a regular line comment without gn metadata',
      });
      // No highlight ranges for non-^gn comments
      expect(highlightRanges).toHaveLength(0);
    });

    it('should skip comments for different files', async () => {
      const comment = makeComment({
        id: 3,
        path: 'docs/other.md',
      });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(0);
    });

    it('should group replies under the parent comment thread', async () => {
      const parent = makeComment({
        id: 100,
        body: '^gn:5:R:0:10\n> 📌 **"heading"** (chars 0–10)\n\nIs this correct?',
        path: 'docs/readme.md',
        line: 5,
        userLogin: 'alice',
      });
      const reply = makeComment({
        id: 101,
        body: 'Yes, looks good to me',
        path: 'docs/readme.md',
        line: 5,
        inReplyToId: 100,
        userLogin: 'bob',
      });
      const prService = makeMockPrService([parent, reply]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].comments).toHaveLength(2);
      expect(threads[0].comments[0]).toMatchObject({
        body: 'Is this correct?',
        author: { name: 'alice' },
      });
      expect(threads[0].comments[1]).toMatchObject({
        body: 'Yes, looks good to me',
        author: { name: 'bob' },
      });
    });

    it('should clear existing threads for the URI before creating new ones', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      // First sync
      await sync.syncForDocument(uri, 'docs/readme.md', makePr());
      const threads1 = __getCommentThreads();
      expect(threads1).toHaveLength(1);

      // Second sync should clear the first thread
      await sync.syncForDocument(uri, 'docs/readme.md', makePr());
      expect(threads1[0].dispose).toHaveBeenCalled();
    });

    it('should create separate threads for different ^gn comments on the same file', async () => {
      const comment1 = makeComment({
        id: 10,
        body: '^gn:5:R:0:10\n\nFirst comment',
        path: 'docs/readme.md',
        line: 5,
      });
      const comment2 = makeComment({
        id: 20,
        body: '^gn:12:R:3:20\n\nSecond comment',
        path: 'docs/readme.md',
        line: 12,
      });
      const prService = makeMockPrService([comment1, comment2]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(2);
    });

    it('should handle API errors gracefully (empty comment list)', async () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(0);
    });

    it('should use unknown as author when userLogin is undefined', async () => {
      const comment = makeComment({
        id: 50,
        body: '^gn:10:R:5:15\n\nAnonymous comment',
        path: 'docs/readme.md',
        userLogin: undefined,
      });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads[0].comments[0]).toMatchObject({
        author: { name: 'unknown' },
      });
    });
  });

  describe('cache behavior', () => {
    it('should cache comments and reuse on subsequent sync calls', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      expect(prService.listReviewComments).toHaveBeenCalledTimes(1);
    });

    it('should fetch fresh comments after invalidateCache()', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      sync.invalidateCache();
      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      expect(prService.listReviewComments).toHaveBeenCalledTimes(2);
    });
  });
});
