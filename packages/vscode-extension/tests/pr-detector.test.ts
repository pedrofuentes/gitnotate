import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { exec } from 'child_process';
import { detectCurrentPR } from '../src/pr-detector';

const mockExec = vi.mocked(exec);

function simulateExec(stdout: string, stderr = '') {
  return (_cmd: string, callback: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    callback(null, { stdout, stderr });
  };
}

function simulateExecError(error: Error) {
  return (_cmd: string, callback: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    callback(error, { stdout: '', stderr: '' });
  };
}

describe('detectCurrentPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return PR info when branch has an associated PR', async () => {
    // First call: get current branch name
    mockExec.mockImplementationOnce(simulateExec('feature/my-branch\n') as any);
    // Second call: get remote URL
    mockExec.mockImplementationOnce(simulateExec('https://github.com/octocat/hello-world.git\n') as any);

    // GitHub API call to search for PRs
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

    const result = await detectCurrentPR();

    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123def456',
    });
  });

  it('should return null when on main branch', async () => {
    mockExec.mockImplementationOnce(simulateExec('main\n') as any);

    const result = await detectCurrentPR();

    expect(result).toBeNull();
  });

  it('should return null when on master branch', async () => {
    mockExec.mockImplementationOnce(simulateExec('master\n') as any);

    const result = await detectCurrentPR();

    expect(result).toBeNull();
  });

  it('should return null when git command fails', async () => {
    mockExec.mockImplementationOnce(simulateExecError(new Error('not a git repo')) as any);

    const result = await detectCurrentPR();

    expect(result).toBeNull();
  });

  it('should return null when no PR is found for branch', async () => {
    mockExec.mockImplementationOnce(simulateExec('feature/no-pr\n') as any);
    mockExec.mockImplementationOnce(simulateExec('https://github.com/octocat/hello-world.git\n') as any);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await detectCurrentPR();

    expect(result).toBeNull();
  });

  it('should parse SSH remote URLs', async () => {
    mockExec.mockImplementationOnce(simulateExec('feature/ssh-test\n') as any);
    mockExec.mockImplementationOnce(simulateExec('git@github.com:octocat/hello-world.git\n') as any);

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

    const result = await detectCurrentPR();

    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 99,
      headSha: 'def456',
    });
  });

  it('should handle API errors gracefully', async () => {
    mockExec.mockImplementationOnce(simulateExec('feature/api-error\n') as any);
    mockExec.mockImplementationOnce(simulateExec('https://github.com/octocat/hello-world.git\n') as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    });

    const result = await detectCurrentPR();

    expect(result).toBeNull();
  });

  it('should log error to console.error when git command fails (I-1)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('not a git repo');
    mockExec.mockImplementationOnce(simulateExecError(error) as any);

    await detectCurrentPR();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Gitnotate]'),
      error
    );
    consoleSpy.mockRestore();
  });

  it('should log error to console.error when fetch throws (I-1)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Network failure');
    mockExec.mockImplementationOnce(simulateExec('feature/net-err\n') as any);
    mockExec.mockImplementationOnce(simulateExec('https://github.com/octocat/hello-world.git\n') as any);
    mockFetch.mockRejectedValueOnce(error);

    await detectCurrentPR();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Gitnotate]'),
      error
    );
    consoleSpy.mockRestore();
  });
});
