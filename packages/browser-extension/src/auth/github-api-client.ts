import { getAuthState } from './oauth.js';

const BASE_URL = 'https://api.github.com';

export interface GitHubApiClient {
  get(path: string): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
  put(path: string, body: unknown): Promise<Response>;
  delete(path: string): Promise<Response>;
}

const REQUEST_TIMEOUT_MS = 10_000;

async function request(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);

  // Check for rate limiting
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining === '0' && !response.ok) {
    const resetEpoch = response.headers.get('x-ratelimit-reset');
    const resetDate = resetEpoch
      ? new Date(Number(resetEpoch) * 1000)
      : new Date();
    throw new Error(
      `GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`
    );
  }

  return response;
}

export async function createGitHubApiClient(): Promise<GitHubApiClient | null> {
  const { token } = await getAuthState();

  if (!token) return null;

  return {
    get: (path: string) => request(token, 'GET', path),
    post: (path: string, body: unknown) => request(token, 'POST', path, body),
    put: (path: string, body: unknown) => request(token, 'PUT', path, body),
    delete: (path: string) => request(token, 'DELETE', path),
  };
}
