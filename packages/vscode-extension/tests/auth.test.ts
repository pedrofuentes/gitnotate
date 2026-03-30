import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __setAuthSession,
  __clearAuth,
  __reset,
  authentication,
} from '../__mocks__/vscode';
import { getGitHubToken, ensureAuthenticated, onDidChangeAuth } from '../src/auth';

describe('auth', () => {
  beforeEach(() => {
    __reset();
  });

  describe('getGitHubToken', () => {
    it('returns token when session exists', async () => {
      __setAuthSession({
        accessToken: 'ghp_test123',
        id: 'session-1',
        scopes: ['repo'],
      });

      const token = await getGitHubToken();
      expect(token).toBe('ghp_test123');
    });

    it('returns undefined when no session', async () => {
      __clearAuth();

      const token = await getGitHubToken();
      expect(token).toBeUndefined();
    });

    it('returns undefined when getSession throws', async () => {
      authentication.getSession.mockRejectedValue(new Error('Auth failed'));

      const token = await getGitHubToken();
      expect(token).toBeUndefined();
    });
  });

  describe('ensureAuthenticated', () => {
    it('returns token when user signs in', async () => {
      __setAuthSession({
        accessToken: 'ghp_signed_in',
        id: 'session-2',
        scopes: ['repo'],
      });

      const token = await ensureAuthenticated();
      expect(token).toBe('ghp_signed_in');
      expect(authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo'],
        { createIfNone: true }
      );
    });

    it('throws when user declines sign-in', async () => {
      authentication.getSession.mockResolvedValue(undefined);

      await expect(ensureAuthenticated()).rejects.toThrow();
    });
  });

  describe('onDidChangeAuth', () => {
    it('subscribes to session changes', () => {
      const listener = vi.fn();
      const disposable = onDidChangeAuth(listener);

      expect(authentication.onDidChangeSessions).toHaveBeenCalledWith(listener);
      expect(disposable).toBeDefined();
      expect(disposable.dispose).toBeDefined();
    });
  });
});
