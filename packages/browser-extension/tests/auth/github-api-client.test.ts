import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGitHubApiClient } from '../../src/auth/github-api-client.js';

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

function okResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    }),
    json: async () => body,
  };
}

describe('createGitHubApiClient', () => {
  it('should return null when no token is configured', async () => {
    const client = await createGitHubApiClient();
    expect(client).toBeNull();
  });

  it('should return a client when token exists', async () => {
    store['gn_auth_token'] = 'ghp_test';
    const client = await createGitHubApiClient();
    expect(client).not.toBeNull();
  });

  it('should include Authorization header in requests', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse());

    const client = await createGitHubApiClient();
    await client!.get('/user');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Authorization']).toBe('Bearer ghp_test');
  });

  it('should include Accept header in requests', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse());

    const client = await createGitHubApiClient();
    await client!.get('/user');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Accept']).toBe('application/vnd.github+json');
  });

  it('should use correct base URL', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse());

    const client = await createGitHubApiClient();
    await client!.get('/repos/owner/repo');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/owner/repo');
  });

  it('should handle GET method', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse({ login: 'octocat' }));

    const client = await createGitHubApiClient();
    const resp = await client!.get('/user');
    expect(resp.ok).toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('GET');
  });

  it('should handle POST method with body', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse());

    const client = await createGitHubApiClient();
    await client!.post('/repos/owner/repo/issues', { title: 'Bug' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'Bug' }));
  });

  it('should handle PUT method with body', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse());

    const client = await createGitHubApiClient();
    await client!.put('/user/starred/owner/repo', {});

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
  });

  it('should handle DELETE method', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce(okResponse());

    const client = await createGitHubApiClient();
    await client!.delete('/user/starred/owner/repo');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
  });

  it('should throw on rate limit exceeded', async () => {
    store['gn_auth_token'] = 'ghp_test';
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
      }),
      json: async () => ({ message: 'API rate limit exceeded' }),
    });

    const client = await createGitHubApiClient();
    await expect(client!.get('/user')).rejects.toThrow('rate limit');
  });
});
