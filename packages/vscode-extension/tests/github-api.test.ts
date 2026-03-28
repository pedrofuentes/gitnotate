import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubApiClient } from '../src/github-api';
import type { PullRequestInfo } from '../src/github-api';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GitHubApiClient', () => {
  const token = 'ghp_test_token_123';
  let client: GitHubApiClient;
  const pr: PullRequestInfo = {
    owner: 'octocat',
    repo: 'hello-world',
    number: 42,
    headSha: 'abc123def456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubApiClient(token);
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
        '<!-- @gn {"exact":"hello","start":0,"end":5} -->\n> 📌 **"hello"** (chars 0–5)\n\nLooks good!'
      );

      expect(result).toBe(true);
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
        json: async () => ({ message: 'Validation Failed' }),
      });

      const result = await client.createReviewComment(
        pr,
        'file.ts',
        1,
        'RIGHT',
        'comment'
      );

      expect(result).toBe(false);
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

      expect(result).toBe(false);
    });
  });

  describe('listReviewComments', () => {
    it('should list review comments', async () => {
      const mockComments = [
        { body: 'First comment', path: 'src/a.ts', line: 5 },
        { body: 'Second comment', path: 'src/b.ts', line: 12 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockComments,
      });

      const comments = await client.listReviewComments(pr);

      expect(comments).toHaveLength(2);
      expect(comments[0]).toEqual({
        body: 'First comment',
        path: 'src/a.ts',
        line: 5,
      });
      expect(comments[1]).toEqual({
        body: 'Second comment',
        path: 'src/b.ts',
        line: 12,
      });
    });

    it('should call correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await client.listReviewComments(pr);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://api.github.com/repos/octocat/hello-world/pulls/42/comments'
      );
      expect(options.method).toBe('GET');
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
  });
});
