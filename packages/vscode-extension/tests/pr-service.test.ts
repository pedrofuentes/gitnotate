import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrService } from '../src/pr-service';
import type { PullRequestInfo } from '../src/pr-service';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PrService', () => {
  const token = 'ghp_test_token_123';
  let client: PrService;
  const pr: PullRequestInfo = {
    owner: 'octocat',
    repo: 'hello-world',
    number: 42,
    headSha: 'abc123def456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new PrService(token);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createReviewComment', () => {
    it('should create a review comment via API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1, body: 'test comment' }),
      });

      const result = await client.createReviewComment(
        pr,
        'src/index.ts',
        10,
        'RIGHT',
        '<!-- ^gn {"exact":"hello","start":0,"end":5} -->\n> 📌 **"hello"** (chars 0–5)\n\nLooks good!'
      );

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://api.github.com/repos/octocat/hello-world/pulls/42/comments'
      );
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.path).toBe('src/index.ts');
      expect(body.line).toBe(10);
      expect(body.side).toBe('RIGHT');
      expect(body.commit_id).toBe('abc123def456');
    });

    it('should include correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 }),
      });

      await client.createReviewComment(pr, 'file.ts', 1, 'LEFT', 'comment');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe(`Bearer ${token}`);
      expect(options.headers['Accept']).toBe('application/vnd.github+json');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should return false on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => JSON.stringify({ message: 'Validation Failed', errors: [] }),
      });

      const result = await client.createReviewComment(
        pr,
        'file.ts',
        1,
        'RIGHT',
        'comment'
      );

      expect(result.ok).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.createReviewComment(
        pr,
        'file.ts',
        1,
        'RIGHT',
        'comment'
      );

      expect(result.ok).toBe(false);
    });

    it('should log error to console.error on network failure (I-1)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Network error');
      mockFetch.mockRejectedValueOnce(error);

      await client.createReviewComment(pr, 'file.ts', 1, 'RIGHT', 'comment');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Gitnotate]'),
        error
      );
      consoleSpy.mockRestore();
    });
  });

  describe('listReviewComments', () => {
    it('should list review comments with extended fields', async () => {
      const mockComments = [
        {
          id: 101,
          body: 'First comment',
          path: 'src/a.ts',
          line: 5,
          side: 'RIGHT',
          in_reply_to_id: undefined,
          user: { login: 'octocat' },
          created_at: '2026-03-29T10:00:00Z',
          updated_at: '2026-03-29T10:00:00Z',
        },
        {
          id: 102,
          body: 'Second comment',
          path: 'src/b.ts',
          line: 12,
          side: 'LEFT',
          in_reply_to_id: 101,
          user: { login: 'reviewer' },
          created_at: '2026-03-29T11:00:00Z',
          updated_at: '2026-03-29T12:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => mockComments,
      });

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(2);
      expect(comments[0]).toEqual({
        id: 101,
        body: 'First comment',
        path: 'src/a.ts',
        line: 5,
        side: 'RIGHT',
        inReplyToId: undefined,
        userLogin: 'octocat',
        createdAt: '2026-03-29T10:00:00Z',
        updatedAt: '2026-03-29T10:00:00Z',
      });
      expect(comments[1]).toEqual({
        id: 102,
        body: 'Second comment',
        path: 'src/b.ts',
        line: 12,
        side: 'LEFT',
        inReplyToId: 101,
        userLogin: 'reviewer',
        createdAt: '2026-03-29T11:00:00Z',
        updatedAt: '2026-03-29T12:00:00Z',
      });
    });

    it('should call correct endpoint with per_page=100', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [],
      });

      await client.listReviewComments(pr);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://api.github.com/repos/octocat/hello-world/pulls/42/comments?per_page=100&page=1'
      );
      expect(options.method).toBe('GET');
    });

    it('should paginate when response contains 100 items', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        body: `comment ${i + 1}`,
        path: 'src/a.ts',
        line: 1,
        side: 'RIGHT',
        in_reply_to_id: undefined,
        user: { login: 'user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));
      const page2 = [
        {
          id: 101,
          body: 'last comment',
          path: 'src/a.ts',
          line: 2,
          side: 'RIGHT',
          in_reply_to_id: undefined,
          user: { login: 'user' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: async () => page1 })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: async () => page2 });

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(101);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const secondUrl = mockFetch.mock.calls[1][0];
      expect(secondUrl).toContain('page=2');
    });

    it('should stop paginating when response has fewer than 100 items', async () => {
      const page1 = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        body: `comment ${i + 1}`,
        path: 'src/a.ts',
        line: 1,
        side: 'RIGHT',
        in_reply_to_id: undefined,
        user: { login: 'user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: async () => page1 });

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(50);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      });

      const comments = await client.listReviewComments(pr);

      expect(comments).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const comments = await client.listReviewComments(pr);

      expect(comments).toEqual([]);
    });

    it('should log error to console.error on network failure (I-1)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Network error');
      mockFetch.mockRejectedValueOnce(error);

      await client.listReviewComments(pr);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Gitnotate]'),
        error
      );
      consoleSpy.mockRestore();
    });

    it('should include correct headers for GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [],
      });

      await client.listReviewComments(pr);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe(`Bearer ${token}`);
      expect(options.headers['Accept']).toBe('application/vnd.github+json');
    });

    it('should handle missing user field gracefully', async () => {
      const mockComments = [
        {
          id: 200,
          body: 'orphan comment',
          path: 'src/a.ts',
          line: 1,
          side: 'RIGHT',
          in_reply_to_id: undefined,
          user: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => mockComments,
      });

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(1);
      expect(comments[0].userLogin).toBeUndefined();
    });

    it('should stop paginating after MAX_PAGES (10) even if API returns full pages', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        body: `comment ${i + 1}`,
        path: 'src/a.ts',
        line: 1,
        side: 'RIGHT',
        in_reply_to_id: undefined,
        user: { login: 'user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));

      // Return full pages indefinitely
      for (let i = 0; i < 15; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => fullPage.map((c) => ({ ...c, id: c.id + i * 100 })),
        });
      }

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(1000); // 10 pages × 100
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('should return all accumulated comments when MAX_PAGES is reached', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        body: `comment ${i + 1}`,
        path: 'src/a.ts',
        line: 1,
        side: 'RIGHT',
        in_reply_to_id: undefined,
        user: { login: 'user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));

      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => fullPage.map((c) => ({ ...c, id: c.id + i * 100 })),
        });
      }

      const comments = await client.listReviewComments(pr);

      // Verify we got comments from all 10 pages
      expect(comments.length).toBe(1000);
      // First comment from page 1
      expect(comments[0].id).toBe(1);
      // Last comment from page 10
      expect(comments[999].id).toBe(1000);
    });

    it('should log a warning when MAX_PAGES is reached', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        body: `comment ${i + 1}`,
        path: 'src/a.ts',
        line: 1,
        side: 'RIGHT',
        in_reply_to_id: undefined,
        user: { login: 'user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));

      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => fullPage.map((c) => ({ ...c, id: c.id + i * 100 })),
        });
      }

      await client.listReviewComments(pr);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Gitnotate]'),
        expect.stringContaining('MAX_PAGES')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('listReviewComments — ETag conditional requests', () => {
    function makeHeaders(entries: Record<string, string> = {}) {
      return { get: (key: string) => entries[key.toLowerCase()] ?? null };
    }

    const comment1 = {
      id: 1,
      body: 'hello',
      path: 'src/a.ts',
      line: 1,
      side: 'RIGHT',
      in_reply_to_id: undefined,
      user: { login: 'alice' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const comment2 = {
      id: 2,
      body: 'world',
      path: 'src/b.ts',
      line: 5,
      side: 'LEFT',
      in_reply_to_id: undefined,
      user: { login: 'bob' },
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    it('first call returns comments normally (no If-None-Match header sent)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"abc123"' }),
        json: async () => [comment1],
      });

      const result = await client.listReviewComments(pr);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].body).toBe('hello');

      // No If-None-Match on first request
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['If-None-Match']).toBeUndefined();
    });

    it('first call stores ETag from response header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"etag-value-1"' }),
        json: async () => [comment1],
      });

      await client.listReviewComments(pr);

      // Second call should now use the stored ETag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"etag-value-2"' }),
        json: async () => [comment1],
      });

      await client.listReviewComments(pr);

      const [, options] = mockFetch.mock.calls[1];
      expect(options.headers['If-None-Match']).toBe('"etag-value-1"');
    });

    it('second call sends If-None-Match with stored ETag', async () => {
      // First call — stores ETag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"my-etag"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      // Second call — should include If-None-Match
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"my-etag"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      const [, secondOptions] = mockFetch.mock.calls[1];
      expect(secondOptions.headers['If-None-Match']).toBe('"my-etag"');
    });

    it('second call with 304 response returns null', async () => {
      // First call — stores ETag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"unchanged"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      // Second call — 304 Not Modified
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: makeHeaders(),
      });
      const result = await client.listReviewComments(pr);

      expect(result).toBeNull();
      // Should not fetch additional pages
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('second call with 200 response (new ETag) returns new comments', async () => {
      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"old-etag"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      // Second call — new content, new ETag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"new-etag"' }),
        json: async () => [comment1, comment2],
      });
      const result = await client.listReviewComments(pr);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);

      // Third call should use the new ETag
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: makeHeaders(),
      });
      const result3 = await client.listReviewComments(pr);
      expect(result3).toBeNull();

      const [, thirdOptions] = mockFetch.mock.calls[2];
      expect(thirdOptions.headers['If-None-Match']).toBe('"new-etag"');
    });

    it('clearEtagCache clears all stored ETags', async () => {
      // First call stores an ETag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"cached-etag"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      // Clear the cache
      client.clearEtagCache();

      // Next call should NOT send If-None-Match
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"fresh-etag"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      const [, options] = mockFetch.mock.calls[1];
      expect(options.headers['If-None-Match']).toBeUndefined();
    });

    it('error responses still throw normally', async () => {
      // First call — stores ETag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: makeHeaders({ etag: '"some-etag"' }),
        json: async () => [comment1],
      });
      await client.listReviewComments(pr);

      // Second call — server error (not 304)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: makeHeaders(),
      });
      const result = await client.listReviewComments(pr);

      // Should return empty array (existing error behavior), not null
      expect(result).toEqual([]);
    });

    it('pagination still works when ETag is fresh (200 on page 1)', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        body: `comment ${i + 1}`,
        path: 'src/a.ts',
        line: 1,
        side: 'RIGHT',
        in_reply_to_id: undefined,
        user: { login: 'user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }));
      const page2 = [comment2];

      // First call — page 1 returns full page with ETag
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: makeHeaders({ etag: '"paginated-etag"' }),
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: makeHeaders(),
          json: async () => page2,
        });

      const result = await client.listReviewComments(pr);

      expect(result).toHaveLength(101);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify page 2 was fetched without If-None-Match (ETag only on page 1)
      const [, page2Options] = mockFetch.mock.calls[1];
      expect(page2Options.headers['If-None-Match']).toBeUndefined();
    });
  });

  describe('createReviewWithComment', () => {
    it('should POST to /pulls/{number}/reviews', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 777 }),
      });

      await client.createReviewWithComment(pr, 'src/index.ts', 10, 'RIGHT', 'Nice!');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://api.github.com/repos/octocat/hello-world/pulls/42/reviews'
      );
      expect(options.method).toBe('POST');
    });

    it('should send event: COMMENT and comments array in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 777 }),
      });

      await client.createReviewWithComment(pr, 'src/index.ts', 10, 'RIGHT', 'Nice!');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('COMMENT');
      expect(body.comments).toBeInstanceOf(Array);
      expect(body.comments).toHaveLength(1);
    });

    it('should include correct commit_id, path, line, side, body in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 777 }),
      });

      await client.createReviewWithComment(pr, 'src/app.ts', 25, 'LEFT', 'Fix this');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.commit_id).toBe('abc123def456');
      expect(body.comments[0]).toEqual({
        path: 'src/app.ts',
        line: 25,
        side: 'LEFT',
        body: 'Fix this',
      });
    });

    it('should return ok:true with review ID on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 777 }),
      });

      const result = await client.createReviewWithComment(pr, 'src/index.ts', 10, 'RIGHT', 'Nice!');

      expect(result).toEqual({ ok: true, id: 777 });
    });

    it('should return ok:false with userMessage on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => JSON.stringify({ message: 'Validation Failed', errors: [] }),
      });

      const result = await client.createReviewWithComment(pr, 'file.ts', 1, 'RIGHT', 'comment');

      expect(result.ok).toBe(false);
      expect('userMessage' in result && result.userMessage).toBeTruthy();
    });

    it('should return ok:false with userMessage on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.createReviewWithComment(pr, 'file.ts', 1, 'RIGHT', 'comment');

      expect(result.ok).toBe(false);
      expect('userMessage' in result && result.userMessage).toBeTruthy();
    });
  });

  describe('createReplyComment', () => {
    it('should send correct payload to replies endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 999, body: 'reply text' }),
      });

      await client.createReplyComment(pr, 'Great point!', 42);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://api.github.com/repos/octocat/hello-world/pulls/comments/42/replies'
      );
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.body).toBe('Great point!');
      expect(body.in_reply_to_id).toBeUndefined();
      expect(body.path).toBeUndefined();
    });

    it('should return ok:true with comment ID on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 555, body: 'reply' }),
      });

      const result = await client.createReplyComment(pr, 'reply', 100);

      expect(result).toEqual({ ok: true, id: 555 });
    });

    it('should return ok:false with userMessage on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => JSON.stringify({ message: 'Validation Failed', errors: [] }),
      });

      const result = await client.createReplyComment(pr, 'reply', 100);

      expect(result.ok).toBe(false);
      expect('userMessage' in result && result.userMessage).toBeTruthy();
    });

    it('should return ok:false with userMessage on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.createReplyComment(pr, 'reply', 100);

      expect(result.ok).toBe(false);
      expect('userMessage' in result && result.userMessage).toBeTruthy();
    });
  });
});
