import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAuthState,
  setToken,
  clearToken,
  validateToken,
} from '../../src/auth/oauth.js';

// --- chrome.storage.local mock ---
let store: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys: string[] | null) => {
        if (keys === null) return Promise.resolve({ ...store });
        return Promise.resolve(
          Object.fromEntries(
            keys.filter((k) => k in store).map((k) => [k, store[k]])
          )
        );
      },
      set: (items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      },
      remove: (keys: string[]) => {
        for (const k of keys) delete store[k];
        return Promise.resolve();
      },
    },
  },
} as unknown as typeof chrome;

// --- fetch mock ---
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

beforeEach(() => {
  store = {};
  fetchMock.mockReset();
});

// Helper: build a successful GitHub /user response
function mockValidToken(username = 'octocat', scopes = 'repo,read:user') {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ 'x-oauth-scopes': scopes }),
    json: async () => ({ login: username }),
  });
}

function mockInvalidToken() {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 401,
    headers: new Headers(),
    json: async () => ({ message: 'Bad credentials' }),
  });
}

describe('oauth – getAuthState', () => {
  it('should return null token when not authenticated', async () => {
    const state = await getAuthState();
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
    expect(state.scopes).toEqual([]);
  });

  it('should return stored auth state when token exists', async () => {
    store['gn_auth_token'] = 'ghp_abc123';
    store['gn_auth_username'] = 'octocat';
    store['gn_auth_scopes'] = ['repo', 'read:user'];

    const state = await getAuthState();
    expect(state.token).toBe('ghp_abc123');
    expect(state.username).toBe('octocat');
    expect(state.scopes).toEqual(['repo', 'read:user']);
  });
});

describe('oauth – validateToken', () => {
  it('should validate a good token by calling GitHub API', async () => {
    mockValidToken('octocat', 'repo,read:user');

    const result = await validateToken('ghp_valid');
    expect(result.valid).toBe(true);
    expect(result.username).toBe('octocat');
    expect(result.scopes).toEqual(['repo', 'read:user']);

    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ghp_valid',
        Accept: 'application/vnd.github+json',
      },
    });
  });

  it('should reject an invalid token', async () => {
    mockInvalidToken();

    const result = await validateToken('ghp_invalid');
    expect(result.valid).toBe(false);
    expect(result.username).toBe('');
    expect(result.scopes).toEqual([]);
  });

  it('should handle empty scopes header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      json: async () => ({ login: 'octocat' }),
    });

    const result = await validateToken('ghp_noscopes');
    expect(result.valid).toBe(true);
    expect(result.username).toBe('octocat');
    expect(result.scopes).toEqual([]);
  });

  it('should handle network errors gracefully', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const result = await validateToken('ghp_err');
    expect(result.valid).toBe(false);
    expect(result.username).toBe('');
    expect(result.scopes).toEqual([]);
  });
});

describe('oauth – setToken', () => {
  it('should validate and store a valid token', async () => {
    mockValidToken('octocat', 'repo');

    await setToken('ghp_valid');

    expect(store['gn_auth_token']).toBe('ghp_valid');
    expect(store['gn_auth_username']).toBe('octocat');
    expect(store['gn_auth_scopes']).toEqual(['repo']);
  });

  it('should store username after validation', async () => {
    mockValidToken('myuser', 'repo,gist');

    await setToken('ghp_mytoken');

    expect(store['gn_auth_username']).toBe('myuser');
  });

  it('should throw when setting an invalid token', async () => {
    mockInvalidToken();

    await expect(setToken('ghp_bad')).rejects.toThrow(
      'Invalid GitHub token'
    );
    expect(store['gn_auth_token']).toBeUndefined();
  });
});

describe('oauth – clearToken', () => {
  it('should remove token, username, and scopes from storage', async () => {
    store['gn_auth_token'] = 'ghp_abc';
    store['gn_auth_username'] = 'octocat';
    store['gn_auth_scopes'] = ['repo'];

    await clearToken();

    expect(store['gn_auth_token']).toBeUndefined();
    expect(store['gn_auth_username']).toBeUndefined();
    expect(store['gn_auth_scopes']).toBeUndefined();
  });

  it('should not throw when clearing already empty storage', async () => {
    await expect(clearToken()).resolves.not.toThrow();
  });
});
