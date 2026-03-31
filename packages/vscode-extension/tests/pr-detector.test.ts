import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectCurrentPR } from '../src/pr-detector';
import { GitService } from '../src/git-service';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createMockGitService(overrides: Partial<GitService> = {}): GitService {
  return {
    isAvailable: () => true,
    getCurrentBranch: () => 'feature/my-branch',
    getRemoteUrl: () => 'https://github.com/octocat/hello-world.git',
    getHeadCommit: () => 'abc123',
    parseGitHubOwnerRepo: (url: string) => {
      const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
      return match ? { owner: match[1], repo: match[2] } : null;
    },
    isDefaultBranch: () => false,
    ...overrides,
  } as GitService;
}

describe('detectCurrentPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return PR info when branch has an associated PR', async () => {
    const git = createMockGitService();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          number: 42,
          head: {
            sha: 'abc123def456',
            ref: 'feature/my-branch',
          },
        },
      ],
    });

    const result = await detectCurrentPR(git);

    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123def456',
    });
  });

  it('should return null when on default branch', async () => {
    const git = createMockGitService({
      getCurrentBranch: () => 'main',
      isDefaultBranch: () => true,
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should return null when git is not available', async () => {
    const git = createMockGitService({
      isAvailable: () => false,
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should return null when branch is undefined', async () => {
    const git = createMockGitService({
      getCurrentBranch: () => undefined as unknown as string,
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should return null when remote URL is undefined', async () => {
    const git = createMockGitService({
      getRemoteUrl: () => undefined as unknown as string,
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should return null when remote URL is not a GitHub URL', async () => {
    const git = createMockGitService({
      getRemoteUrl: () => 'https://gitlab.com/octocat/hello-world.git',
      parseGitHubOwnerRepo: () => null,
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should return null when no PR is found for branch', async () => {
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/no-pr',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should parse SSH remote URLs', async () => {
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/ssh-test',
      getRemoteUrl: () => 'git@github.com:octocat/hello-world.git',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          number: 99,
          head: { sha: 'def456', ref: 'feature/ssh-test' },
        },
      ],
    });

    const result = await detectCurrentPR(git);

    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 99,
      headSha: 'def456',
    });
  });

  it('should handle API errors gracefully', async () => {
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/api-error',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
  });

  it('should log error to console.error when fetch throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Network failure');
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/net-err',
    });
    mockFetch.mockRejectedValueOnce(error);

    await detectCurrentPR(git);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Gitnotate]'),
      expect.stringContaining('detectCurrentPR failed'),
      error
    );
    consoleSpy.mockRestore();
  });

  it('should include Authorization header when token provided', async () => {
    const git = createMockGitService();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await detectCurrentPR(git, 'ghp_test_token_123');

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer ghp_test_token_123');
  });

  it('should not include Authorization header when no token', async () => {
    const git = createMockGitService();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await detectCurrentPR(git);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe('detectCurrentPR — rate limit handling (I-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null and warn on 403 rate limit response', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/rate-limited',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      }),
      json: async () => ({ message: 'API rate limit exceeded' }),
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Gitnotate]'),
      expect.stringContaining('rate limit'),
    );
    consoleSpy.mockRestore();
  });

  it('should return null and warn on 429 Too Many Requests response', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/rate-limited-429',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({
        'retry-after': '60',
      }),
      json: async () => ({ message: 'Too Many Requests' }),
    });

    const result = await detectCurrentPR(git);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Gitnotate]'),
      expect.stringContaining('rate limit'),
    );
    consoleSpy.mockRestore();
  });

  it('should include a timeout signal on the fetch call', async () => {
    const git = createMockGitService({
      getCurrentBranch: () => 'feature/timeout-test',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await detectCurrentPR(git);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.signal).toBeDefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
