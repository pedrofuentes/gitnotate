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
        json: async () => [],
      });

      await client.listReviewComments(pr);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://api.github.com/repos/octocat/hello-world/pulls/42/comments?per_page=100'
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
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => page1 })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => page2 });

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

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => page1 });

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
        json: async () => mockComments,
      });

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(1);
      expect(comments[0].userLogin).toBeUndefined();
    });
  });
});
