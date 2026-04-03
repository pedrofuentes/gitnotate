import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setGitRepository, __reset } from '../__mocks__/vscode';
import { GitService } from '../src/git-service';

function makeRepo(overrides: {
  head?: { name?: string; commit?: string };
  remotes?: Array<{ name: string; fetchUrl: string }>;
} = {}) {
  return {
    state: {
      HEAD: overrides.head ?? undefined,
      remotes: overrides.remotes ?? [],
      onDidChange: vi.fn((_listener: () => void) => ({ dispose: vi.fn() })),
    },
  };
}

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    __reset();
    service = new GitService();
  });

  describe('getCurrentBranch', () => {
    it('returns branch name from HEAD', () => {
      __setGitRepository(makeRepo({ head: { name: 'feature/login', commit: 'abc123' } }));
      service = new GitService();

      expect(service.getCurrentBranch()).toBe('feature/login');
    });

    it('returns undefined when no HEAD', () => {
      __setGitRepository(makeRepo({ head: undefined }));
      service = new GitService();

      expect(service.getCurrentBranch()).toBeUndefined();
    });

    it('returns undefined when no repositories', () => {
      // No git repository set — extensions.getExtension returns undefined
      expect(service.getCurrentBranch()).toBeUndefined();
    });
  });

  describe('getRemoteUrl', () => {
    it('returns fetchUrl for origin by default', () => {
      __setGitRepository(makeRepo({
        head: { name: 'main', commit: 'abc' },
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/owner/repo.git' }],
      }));
      service = new GitService();

      expect(service.getRemoteUrl()).toBe('https://github.com/owner/repo.git');
    });

    it('returns fetchUrl for specified remote name', () => {
      __setGitRepository(makeRepo({
        head: { name: 'main', commit: 'abc' },
        remotes: [
          { name: 'origin', fetchUrl: 'https://github.com/owner/repo.git' },
          { name: 'upstream', fetchUrl: 'https://github.com/upstream/repo.git' },
        ],
      }));
      service = new GitService();

      expect(service.getRemoteUrl('upstream')).toBe('https://github.com/upstream/repo.git');
    });

    it('returns undefined when remote not found', () => {
      __setGitRepository(makeRepo({
        head: { name: 'main', commit: 'abc' },
        remotes: [{ name: 'origin', fetchUrl: 'https://github.com/owner/repo.git' }],
      }));
      service = new GitService();

      expect(service.getRemoteUrl('nonexistent')).toBeUndefined();
    });
  });

  describe('getHeadCommit', () => {
    it('returns commit SHA', () => {
      __setGitRepository(makeRepo({ head: { name: 'main', commit: 'deadbeef1234' } }));
      service = new GitService();

      expect(service.getHeadCommit()).toBe('deadbeef1234');
    });

    it('returns undefined when no HEAD', () => {
      __setGitRepository(makeRepo({ head: undefined }));
      service = new GitService();

      expect(service.getHeadCommit()).toBeUndefined();
    });
  });

  describe('parseGitHubOwnerRepo', () => {
    it('parses HTTPS URL with .git', () => {
      const result = service.parseGitHubOwnerRepo('https://github.com/octocat/hello-world.git');

      expect(result).toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('parses HTTPS URL without .git', () => {
      const result = service.parseGitHubOwnerRepo('https://github.com/octocat/hello-world');

      expect(result).toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('parses SSH URL', () => {
      const result = service.parseGitHubOwnerRepo('git@github.com:octocat/hello-world.git');

      expect(result).toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('returns null for non-GitHub URLs', () => {
      const result = service.parseGitHubOwnerRepo('https://gitlab.com/owner/repo.git');

      expect(result).toBeNull();
    });
  });

  describe('isDefaultBranch', () => {
    it('returns true for main', () => {
      __setGitRepository(makeRepo({ head: { name: 'main', commit: 'abc' } }));
      service = new GitService();

      expect(service.isDefaultBranch()).toBe(true);
    });

    it('returns true for master', () => {
      __setGitRepository(makeRepo({ head: { name: 'master', commit: 'abc' } }));
      service = new GitService();

      expect(service.isDefaultBranch()).toBe(true);
    });

    it('returns false for feature branches', () => {
      __setGitRepository(makeRepo({ head: { name: 'feature/new-thing', commit: 'abc' } }));
      service = new GitService();

      expect(service.isDefaultBranch()).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('returns true when git extension has repositories', () => {
      __setGitRepository(makeRepo({ head: { name: 'main', commit: 'abc' } }));
      service = new GitService();

      expect(service.isAvailable()).toBe(true);
    });

    it('returns false when no git extension', () => {
      // No git repository set — default state
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('onDidChangeState', () => {
    it('returns a disposable when git is available', () => {
      __setGitRepository(makeRepo({ head: { name: 'main', commit: 'abc' } }));
      service = new GitService();

      const listener = vi.fn();
      const disposable = service.onDidChangeState(listener);
      expect(disposable).toBeDefined();
      expect(disposable!.dispose).toBeDefined();
    });

    it('returns undefined when git is not available', () => {
      const disposable = service.onDidChangeState(vi.fn());
      expect(disposable).toBeUndefined();
    });
  });
});
