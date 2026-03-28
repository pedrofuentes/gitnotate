import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SidecarFile } from '@gitnotate/core';

// Mock the github-api-client module
const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../src/auth/github-api-client', () => ({
  createGitHubApiClient: vi.fn(),
}));

import { createGitHubApiClient } from '../../src/auth/github-api-client';
import { readSidecarFile, writeSidecarFile } from '../../src/content/sidecar-client';

const mockedCreate = vi.mocked(createGitHubApiClient);

const sampleSidecar: SidecarFile = {
  $schema: 'https://gitnotate.com/schema/v1',
  version: '1.0',
  file: 'src/index.ts',
  annotations: [
    {
      id: 'a1',
      target: { exact: 'hello world' },
      author: { github: 'octocat' },
      body: 'Nice greeting!',
      created: '2024-01-01T00:00:00Z',
      resolved: false,
      replies: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreate.mockResolvedValue(mockClient);
});

describe('readSidecarFile', () => {
  it('should read existing sidecar file', async () => {
    const encoded = btoa(JSON.stringify(sampleSidecar, null, 2));
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, sha: 'abc123', encoding: 'base64' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toEqual(sampleSidecar);
    expect(mockClient.get).toHaveBeenCalledWith(
      '/repos/owner/repo/contents/.comments/src/index.ts.json'
    );
  });

  it('should return null when sidecar does not exist (404)', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/missing.ts');

    expect(result).toBeNull();
  });

  it('should return null when not authenticated', async () => {
    mockedCreate.mockResolvedValueOnce(null);

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toBeNull();
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it('should pass ref query parameter when provided', async () => {
    const encoded = btoa(JSON.stringify(sampleSidecar, null, 2));
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, sha: 'abc123', encoding: 'base64' }),
    });

    await readSidecarFile('owner', 'repo', 'src/index.ts', 'feature-branch');

    expect(mockClient.get).toHaveBeenCalledWith(
      '/repos/owner/repo/contents/.comments/src/index.ts.json?ref=feature-branch'
    );
  });
});

describe('writeSidecarFile', () => {
  it('should write new sidecar file when none exists', async () => {
    // GET returns 404 — file doesn't exist yet
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    // PUT succeeds
    mockClient.put.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ content: { sha: 'new123' } }),
    });

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar);

    expect(result).toBe(true);
    expect(mockClient.put).toHaveBeenCalledTimes(1);

    const [path, body] = mockClient.put.mock.calls[0];
    expect(path).toBe('/repos/owner/repo/contents/.comments/src/index.ts.json');
    expect(body.content).toBe(btoa(JSON.stringify(sampleSidecar, null, 2)));
    expect(body.message).toBeDefined();
    expect(body.sha).toBeUndefined();
  });

  it('should update existing sidecar file with sha', async () => {
    // GET returns existing file with sha
    const encoded = btoa(JSON.stringify(sampleSidecar, null, 2));
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, sha: 'existing-sha', encoding: 'base64' }),
    });
    // PUT succeeds
    mockClient.put.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: { sha: 'updated-sha' } }),
    });

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar);

    expect(result).toBe(true);

    const [, body] = mockClient.put.mock.calls[0];
    expect(body.sha).toBe('existing-sha');
  });

  it('should return false when not authenticated', async () => {
    mockedCreate.mockResolvedValueOnce(null);

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar);

    expect(result).toBe(false);
  });

  it('should return false when PUT fails', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    mockClient.put.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Validation Failed' }),
    });

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar);

    expect(result).toBe(false);
  });

  it('should use custom commit message when provided', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    mockClient.put.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ content: { sha: 'new123' } }),
    });

    await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar, 'Add annotation');

    const [, body] = mockClient.put.mock.calls[0];
    expect(body.message).toBe('Add annotation');
  });
});

describe('sidecar path construction', () => {
  it('should construct correct API path for .comments/{filePath}.json', async () => {
    const encoded = btoa(JSON.stringify(sampleSidecar, null, 2));
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, sha: 'abc123', encoding: 'base64' }),
    });

    await readSidecarFile('myorg', 'myrepo', 'lib/utils/helpers.ts');

    expect(mockClient.get).toHaveBeenCalledWith(
      '/repos/myorg/myrepo/contents/.comments/lib/utils/helpers.ts.json'
    );
  });
});
