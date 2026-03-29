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

vi.mock('../../src/content/logger', () => ({
  debug: vi.fn(),
}));

import { createGitHubApiClient } from '../../src/auth/github-api-client';
import { readSidecarFile, writeSidecarFile } from '../../src/content/sidecar-client';
import { debug } from '../../src/content/logger';

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

  it('should URL-encode ref with special characters', async () => {
    const encoded = btoa(JSON.stringify(sampleSidecar, null, 2));
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, sha: 'abc123', encoding: 'base64' }),
    });

    await readSidecarFile('owner', 'repo', 'src/index.ts', 'feature/my branch');

    expect(mockClient.get).toHaveBeenCalledWith(
      '/repos/owner/repo/contents/.comments/src/index.ts.json?ref=feature%2Fmy%20branch'
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

describe('readSidecarFile — error resilience (F4)', () => {
  it('should return null when response JSON has no content field', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sha: 'abc123' }), // missing content field
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toBeNull();
  });

  it('should return null when content is not valid base64', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: '!!!invalid-base64!!!', sha: 'abc123' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toBeNull();
  });

  it('should return null when decoded content is not valid JSON', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: btoa('not-json{{{'), sha: 'abc123' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toBeNull();
  });

  it('should return null when decoded JSON fails sidecar schema validation', async () => {
    const invalidSidecar = { version: '999', file: '', annotations: 'not-array' };
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: btoa(JSON.stringify(invalidSidecar)), sha: 'abc123' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toBeNull();
  });
});

describe('writeSidecarFile — Unicode safety (F3)', () => {
  it('should handle sidecar with Unicode annotation body (emoji)', async () => {
    const unicodeSidecar: SidecarFile = {
      ...sampleSidecar,
      annotations: [
        {
          ...sampleSidecar.annotations[0],
          body: 'Great work! 🎉🚀 très bien',
        },
      ],
    };

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

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', unicodeSidecar);

    expect(result).toBe(true);
    // Verify the content can be decoded back
    const [, body] = mockClient.put.mock.calls[0];
    const decoded = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0))
    ));
    expect(decoded.annotations[0].body).toBe('Great work! 🎉🚀 très bien');
  });

  it('should handle sidecar with CJK characters', async () => {
    const cjkSidecar: SidecarFile = {
      ...sampleSidecar,
      annotations: [
        {
          ...sampleSidecar.annotations[0],
          body: '这是中文注释 こんにちは',
        },
      ],
    };

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

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', cjkSidecar);

    expect(result).toBe(true);
    // Verify the content can be decoded back
    const [, body] = mockClient.put.mock.calls[0];
    const decoded = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0))
    ));
    expect(decoded.annotations[0].body).toBe('这是中文注释 こんにちは');
  });
});

describe('readSidecarFile — Unicode round-trip (F3)', () => {
  it('should correctly decode Unicode content from base64', async () => {
    const unicodeSidecar: SidecarFile = {
      ...sampleSidecar,
      annotations: [
        {
          ...sampleSidecar.annotations[0],
          body: 'Comment with émojis 🎉 and ñ',
        },
      ],
    };

    // Encode with TextEncoder (the fixed way)
    const jsonStr = JSON.stringify(unicodeSidecar, null, 2);
    const bytes = new TextEncoder().encode(jsonStr);
    const encoded = btoa(String.fromCharCode(...bytes));

    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, sha: 'abc123' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).not.toBeNull();
    expect(result!.annotations[0].body).toBe('Comment with émojis 🎉 and ñ');
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

describe('toBase64 — large payload safety (I-1)', () => {
  it('should handle sidecar bodies larger than 64KB without RangeError', async () => {
    // Create a sidecar with a body large enough to trigger spread overflow in V8
    const largeBody = 'x'.repeat(500_000);
    const largeSidecar: SidecarFile = {
      ...sampleSidecar,
      annotations: [
        {
          ...sampleSidecar.annotations[0],
          body: largeBody,
        },
      ],
    };

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

    // The current spread-based toBase64 will throw RangeError for >64KB
    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', largeSidecar);

    expect(result).toBe(true);
    // Verify the content round-trips correctly
    const [, body] = mockClient.put.mock.calls[0];
    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0))
      )
    );
    expect(decoded.annotations[0].body).toBe(largeBody);
  });
});

describe('writeSidecarFile — non-JSON GET response (I-2)', () => {
  it('should treat as new file when GET returns 200 with non-JSON body', async () => {
    // GET returns 200 but .json() throws (e.g. HTML error page)
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    });
    mockClient.put.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ content: { sha: 'new123' } }),
    });

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar);

    expect(result).toBe(true);
    // sha should be undefined since the GET parse failed — treated as new file
    const [, body] = mockClient.put.mock.calls[0];
    expect(body.sha).toBeUndefined();
  });
});

describe('readSidecarFile — network errors (I-23)', () => {
  it('should propagate error when GET throws a network error', async () => {
    mockClient.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(readSidecarFile('owner', 'repo', 'src/index.ts'))
      .rejects.toThrow('Failed to fetch');
  });

  it('should return null on 403 Forbidden response', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/private.ts');

    expect(result).toBeNull();
  });
});

describe('writeSidecarFile — network errors (I-23)', () => {
  it('should propagate error when PUT throws a network error', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    mockClient.put.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar))
      .rejects.toThrow('Failed to fetch');
  });

  it('should return false on 403 Forbidden PUT response', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    mockClient.put.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    const result = await writeSidecarFile('owner', 'repo', 'src/index.ts', sampleSidecar);

    expect(result).toBe(false);
  });
});

describe('readSidecarFile — error logging (I-3)', () => {
  it('should call debug logger when encountering malformed data', async () => {
    mockClient.get.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: '!!!invalid-base64!!!', sha: 'abc123' }),
    });

    const result = await readSidecarFile('owner', 'repo', 'src/index.ts');

    expect(result).toBeNull();
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read sidecar'),
      expect.any(Error),
    );
  });
});
