import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __reset, __getCommentThreads, Uri, Range, workspace } from '../__mocks__/vscode';
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
      const editedComment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n> 📌 **"some text"** (chars 5–15)\n\nEdited',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T11:00:00Z',
      });
      const listMock = vi.fn()
        .mockResolvedValueOnce([comment])
        .mockResolvedValueOnce([editedComment]);
      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn(),
      } as unknown as PrService;
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      // First sync
      await sync.syncForDocument(uri, 'docs/readme.md', makePr());
      const threads1 = __getCommentThreads();
      expect(threads1).toHaveLength(1);

      // Second sync with changed data should clear the first thread
      sync.invalidateCache();
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

  describe('side-aware rendering', () => {
    it('syncForDocument should show only RIGHT comments in single file view', async () => {
      const rightComment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nRight side comment',
        path: 'docs/readme.md',
        line: 10,
        side: 'RIGHT',
      });
      const leftComment = makeComment({
        id: 2,
        body: '^gn:10:L:5:15\n\nLeft side comment',
        path: 'docs/readme.md',
        line: 10,
        side: 'LEFT',
      });
      const prService = makeMockPrService([rightComment, leftComment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      // Only RIGHT — LEFT comments are skipped in single file view
      expect(threads).toHaveLength(1);
      expect(threads[0].comments[0]).toMatchObject({ body: 'Right side comment' });
    });

    it('syncForDiff should place LEFT comments on originalUri', async () => {
      const rightComment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nRight side comment',
        path: 'docs/readme.md',
        line: 10,
        side: 'RIGHT',
      });
      const leftComment = makeComment({
        id: 2,
        body: '^gn:10:L:5:15\n\nLeft side comment',
        path: 'docs/readme.md',
        line: 10,
        side: 'LEFT',
      });
      const prService = makeMockPrService([rightComment, leftComment]);
      const sync = new CommentThreadSync(prService, commentController);
      const leftUri = Uri.from({ scheme: 'git', path: '/workspace/docs/readme.md' });
      const rightUri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDiff(leftUri, rightUri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(2);
      const leftThread = threads.find((t: any) => t.uri.scheme === 'git');
      expect(leftThread).toBeDefined();
      expect(leftThread!.comments[0]).toMatchObject({ body: 'Left side comment' });
    });

    it('syncForDiff should place RIGHT comments on modifiedUri', async () => {
      const rightComment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nRight side comment',
        path: 'docs/readme.md',
        line: 10,
        side: 'RIGHT',
      });
      const leftComment = makeComment({
        id: 2,
        body: '^gn:10:L:5:15\n\nLeft side comment',
        path: 'docs/readme.md',
        line: 10,
        side: 'LEFT',
      });
      const prService = makeMockPrService([rightComment, leftComment]);
      const sync = new CommentThreadSync(prService, commentController);
      const leftUri = Uri.from({ scheme: 'git', path: '/workspace/docs/readme.md' });
      const rightUri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDiff(leftUri, rightUri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(2);
      const rightThread = threads.find((t: any) => t.uri.scheme === 'file');
      expect(rightThread).toBeDefined();
      expect(rightThread!.comments[0]).toMatchObject({ body: 'Right side comment' });
    });

    it('syncForDiff should handle mixed L/R comments correctly', async () => {
      const comments = [
        makeComment({ id: 1, body: '^gn:5:R:0:10\n\nRight line 5', path: 'docs/readme.md', side: 'RIGHT' }),
        makeComment({ id: 2, body: '^gn:5:L:0:10\n\nLeft line 5', path: 'docs/readme.md', side: 'LEFT' }),
        makeComment({ id: 3, body: '^gn:12:R:3:20\n\nRight line 12', path: 'docs/readme.md', side: 'RIGHT' }),
        makeComment({ id: 4, body: '^gn:8:L:2:18\n\nLeft line 8', path: 'docs/readme.md', side: 'LEFT' }),
      ];
      const prService = makeMockPrService(comments);
      const sync = new CommentThreadSync(prService, commentController);
      const rightUri = Uri.file('/workspace/docs/readme.md');
      const leftUri = Uri.from({ scheme: 'git', path: '/workspace/docs/readme.md' });

      await sync.syncForDiff(leftUri, rightUri, 'docs/readme.md', makePr());

      const allThreads = __getCommentThreads();
      expect(allThreads).toHaveLength(4);
      const leftThreads = allThreads.filter((t: any) => t.uri.scheme === 'git');
      const rightThreads = allThreads.filter((t: any) => t.uri.scheme === 'file');
      expect(leftThreads).toHaveLength(2);
      expect(rightThreads).toHaveLength(2);
    });

    it('syncForDiff should place non-^gn regular line comments on correct side URI', async () => {
      const rightComment = makeComment({
        id: 1,
        body: 'Regular right-side comment',
        path: 'docs/readme.md',
        line: 5,
        side: 'RIGHT',
      });
      const leftComment = makeComment({
        id: 2,
        body: 'Regular left-side comment',
        path: 'docs/readme.md',
        line: 5,
        side: 'LEFT',
      });
      const prService = makeMockPrService([rightComment, leftComment]);
      const sync = new CommentThreadSync(prService, commentController);
      const leftUri = Uri.from({ scheme: 'git', path: '/workspace/docs/readme.md' });
      const rightUri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDiff(leftUri, rightUri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(2);
      const rightThread = threads.find((t: any) => t.uri.scheme === 'file');
      expect(rightThread).toBeDefined();
      expect(rightThread!.comments[0]).toMatchObject({ body: 'Regular right-side comment' });
    });
  });

  describe('getCachedComments', () => {
    it('should return undefined when no cache exists', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);

      const result = sync.getCachedComments(makePr());

      expect(result).toBeUndefined();
    });

    it('should return cached data after a sync populates the cache', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      const cached = sync.getCachedComments(pr);
      expect(cached).toBeDefined();
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe(1);
    });

    it('should return undefined after invalidateCache()', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      sync.invalidateCache();

      expect(sync.getCachedComments(pr)).toBeUndefined();
    });

    it('should preserve PR cache when clearThreads is called (19.3)', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache via sync
      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      expect(sync.getCachedComments(pr)).toHaveLength(1);

      // Clear threads for the file (simulates close handler)
      commentController.clearThreads(uri);

      // PR-level cache should still exist
      expect(sync.getCachedComments(pr)).toHaveLength(1);
      expect(prService.listReviewComments).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncForDocumentCacheFirst', () => {
    it('should fall back to normal sync when no cache exists', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      const ranges = await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', makePr());

      const threads = __getCommentThreads();
      expect(threads).toHaveLength(1);
      expect(ranges).toHaveLength(1);
      expect(prService.listReviewComments).toHaveBeenCalledTimes(1);
    });

    it('should render cached threads immediately when cache exists', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache
      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      const firstCallCount = (prService.listReviewComments as ReturnType<typeof vi.fn>).mock.calls.length;

      // Cache-first should render threads before waiting for API
      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      const threads = __getCommentThreads();
      // Should have threads rendered (old ones disposed + new ones from cache + new ones from refresh)
      expect(threads.length).toBeGreaterThanOrEqual(1);
    });

    it('should update threads when fresh data differs from cache', async () => {
      const oldComment = makeComment({ id: 1, body: '^gn:10:R:5:15\n\nOld comment', path: 'docs/readme.md' });
      const newComment = makeComment({ id: 2, body: '^gn:10:R:5:15\n\nNew comment', path: 'docs/readme.md' });

      const listMock = vi.fn()
        .mockResolvedValueOnce([oldComment])  // first sync (populate cache)
        .mockResolvedValueOnce([newComment]); // cache-first background refresh

      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn().mockResolvedValue({ ok: true }),
      } as unknown as PrService;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache
      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      // Cache-first: should fetch fresh data and update
      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // Should have called API twice (once for initial, once for refresh)
      expect(listMock).toHaveBeenCalledTimes(2);
    });

    it('should not re-render when fresh data matches cache', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache
      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      // Spy on clearThreads to detect re-renders
      const clearSpy = vi.spyOn(commentController, 'clearThreads');
      clearSpy.mockClear();

      // Cache-first with same data
      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // renderComments fingerprint matches the prior syncForDocument render,
      // so cache render is skipped; fresh data also matches — no re-render at all
      expect(clearSpy).toHaveBeenCalledTimes(0);
    });

    it('should not re-render when body and updatedAt are identical', async () => {
      const comment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nOriginal text',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T10:00:00Z',
      });
      // Fresh data returns identical comment
      const freshComment = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nOriginal text',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T10:00:00Z',
      });

      const listMock = vi.fn()
        .mockResolvedValueOnce([comment])
        .mockResolvedValueOnce([freshComment]);

      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn(),
      } as unknown as PrService;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      const clearSpy = vi.spyOn(commentController, 'clearThreads');
      clearSpy.mockClear();

      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // Cache render skipped (fingerprint matches prior syncForDocument) — no re-render
      expect(clearSpy).toHaveBeenCalledTimes(0);
    });

    it('should re-render when a comment body is edited', async () => {
      const original = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nOriginal text',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T10:00:00Z',
      });
      const edited = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nEdited text',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T11:00:00Z',
      });

      const listMock = vi.fn()
        .mockResolvedValueOnce([original])
        .mockResolvedValueOnce([edited]);

      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn(),
      } as unknown as PrService;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      const clearSpy = vi.spyOn(commentController, 'clearThreads');
      clearSpy.mockClear();

      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // Cache render skipped (fingerprint matches); fresh data differs → 1 re-render
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-render when updatedAt changes', async () => {
      const original = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nSame body',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T10:00:00Z',
      });
      const touched = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nSame body',
        path: 'docs/readme.md',
        updatedAt: '2026-03-29T12:00:00Z',
      });

      const listMock = vi.fn()
        .mockResolvedValueOnce([original])
        .mockResolvedValueOnce([touched]);

      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn(),
      } as unknown as PrService;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      const clearSpy = vi.spyOn(commentController, 'clearThreads');
      clearSpy.mockClear();

      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // Cache render skipped (fingerprint matches); fresh data differs → 1 re-render
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-render when a new comment is added', async () => {
      const existing = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nFirst comment',
        path: 'docs/readme.md',
      });
      const added = makeComment({
        id: 2,
        body: '^gn:12:R:0:10\n\nSecond comment',
        path: 'docs/readme.md',
      });

      const listMock = vi.fn()
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce([existing, added]);

      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn(),
      } as unknown as PrService;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      const clearSpy = vi.spyOn(commentController, 'clearThreads');
      clearSpy.mockClear();

      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // Cache render skipped (fingerprint matches); fresh data differs → 1 re-render
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-render when a comment is deleted', async () => {
      const comment1 = makeComment({
        id: 1,
        body: '^gn:10:R:5:15\n\nFirst',
        path: 'docs/readme.md',
      });
      const comment2 = makeComment({
        id: 2,
        body: '^gn:12:R:0:10\n\nSecond',
        path: 'docs/readme.md',
      });

      const listMock = vi.fn()
        .mockResolvedValueOnce([comment1, comment2])
        .mockResolvedValueOnce([comment1]); // comment2 deleted

      const prService = {
        listReviewComments: listMock,
        createReviewComment: vi.fn(),
      } as unknown as PrService;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      await sync.syncForDocument(uri, 'docs/readme.md', pr);

      const clearSpy = vi.spyOn(commentController, 'clearThreads');
      clearSpy.mockClear();

      await sync.syncForDocumentCacheFirst(uri, 'docs/readme.md', pr);

      // Cache render skipped (fingerprint matches); fresh data differs → 1 re-render
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('reveal callback integration', () => {
    it('should NOT call onThreadRevealed during bulk sync (avoids reveal spam)', async () => {
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
      const callback = vi.fn();
      commentController.onThreadRevealed = callback;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT call onThreadRevealed for regular line comments during sync', async () => {
      const comment = makeComment({
        id: 30,
        body: 'A regular line comment',
        path: 'docs/readme.md',
        line: 7,
      });
      const prService = makeMockPrService([comment]);
      const callback = vi.fn();
      commentController.onThreadRevealed = callback;

      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');

      await sync.syncForDocument(uri, 'docs/readme.md', makePr());

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set up interval timer when startPolling is called', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      sync.startPolling(uri, 'docs/readme.md', pr);

      expect(sync.isPolling).toBe(true);

      sync.stopPolling();
    });

    it('should clear interval timer when stopPolling is called', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      sync.startPolling(uri, 'docs/readme.md', pr);
      sync.stopPolling();

      expect(sync.isPolling).toBe(false);
    });

    it('should return true from isPolling when polling, false when not', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);

      expect(sync.isPolling).toBe(false);

      sync.startPolling(Uri.file('/workspace/docs/readme.md'), 'docs/readme.md', makePr());
      expect(sync.isPolling).toBe(true);

      sync.stopPolling();
      expect(sync.isPolling).toBe(false);
    });

    it('should call syncForDocumentCacheFirst on each tick', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache so syncForDocumentCacheFirst doesn't fall back
      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      (prService.listReviewComments as ReturnType<typeof vi.fn>).mockClear();

      sync.startPolling(uri, 'docs/readme.md', pr);

      // Default interval: 30s = 30000ms
      await vi.advanceTimersByTimeAsync(30_000);
      expect(prService.listReviewComments).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(prService.listReviewComments).toHaveBeenCalledTimes(2);

      sync.stopPolling();
    });

    it('should handle errors silently during polling', async () => {
      const prService = makeMockPrService([]);
      (prService.listReviewComments as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      sync.startPolling(uri, 'docs/readme.md', pr);

      // Should not throw
      await vi.advanceTimersByTimeAsync(30_000);

      // Still polling after error
      expect(sync.isPolling).toBe(true);

      sync.stopPolling();
    });

    it('should stop previous timer when starting polling again', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      sync.startPolling(uri, 'docs/readme.md', pr);
      const firstIsPolling = sync.isPolling;

      // Start again — should clear previous timer
      sync.startPolling(uri, 'docs/readme.md', pr);

      expect(firstIsPolling).toBe(true);
      expect(sync.isPolling).toBe(true);

      sync.stopPolling();
    });

    it('should only have one active timer after restarting polling', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache
      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      (prService.listReviewComments as ReturnType<typeof vi.fn>).mockClear();

      sync.startPolling(uri, 'docs/readme.md', pr);
      sync.startPolling(uri, 'docs/readme.md', pr);

      await vi.advanceTimersByTimeAsync(30_000);

      // Should only fire once (not twice from two timers)
      expect(prService.listReviewComments).toHaveBeenCalledTimes(1);

      sync.stopPolling();
    });

    it('should stop polling on dispose', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      sync.startPolling(uri, 'docs/readme.md', pr);
      expect(sync.isPolling).toBe(true);

      sync.dispose();

      expect(sync.isPolling).toBe(false);
    });

    it('should read pollInterval from config with default of 30s', () => {
      const prService = makeMockPrService([]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      sync.startPolling(uri, 'docs/readme.md', pr);

      expect(workspace.getConfiguration).toHaveBeenCalledWith('gitnotate');

      sync.stopPolling();
    });

    it('should enforce minimum polling interval of 10 seconds', async () => {
      const comment = makeComment({ id: 1, path: 'docs/readme.md' });
      const prService = makeMockPrService([comment]);
      const sync = new CommentThreadSync(prService, commentController);
      const uri = Uri.file('/workspace/docs/readme.md');
      const pr = makePr();

      // Populate cache
      await sync.syncForDocument(uri, 'docs/readme.md', pr);
      (prService.listReviewComments as ReturnType<typeof vi.fn>).mockClear();

      // Set pollInterval to 5 (below minimum)
      const mockConfig = workspace.getConfiguration();
      (mockConfig.get as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'pollInterval') return 5;
          return defaultValue;
        }
      );

      sync.startPolling(uri, 'docs/readme.md', pr);

      // At 9s: should NOT have fired yet (minimum is 10s)
      await vi.advanceTimersByTimeAsync(9_000);
      expect(prService.listReviewComments).toHaveBeenCalledTimes(0);

      // At 10s: should fire (clamped to minimum)
      await vi.advanceTimersByTimeAsync(1_000);
      expect(prService.listReviewComments).toHaveBeenCalledTimes(1);

      sync.stopPolling();
    });
  });
});
