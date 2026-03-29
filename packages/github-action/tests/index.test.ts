import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetInput = vi.fn();
const mockInfo = vi.fn();
const mockWarning = vi.fn();
const mockSetFailed = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: (...args: unknown[]) => mockGetInput(...args),
  info: (...args: unknown[]) => mockInfo(...args),
  warning: (...args: unknown[]) => mockWarning(...args),
  setFailed: (...args: unknown[]) => mockSetFailed(...args),
}));

const mockListFiles = vi.fn();
const mockGetContent = vi.fn();
const mockCreateComment = vi.fn();

const mockContext = {
  repo: { owner: 'test-owner', repo: 'test-repo' },
  payload: { pull_request: { number: 42, head: { sha: 'abc123' } } },
};

vi.mock('@actions/github', () => ({
  getOctokit: () => ({
    rest: {
      pulls: { listFiles: (...args: unknown[]) => mockListFiles(...args) },
      repos: { getContent: (...args: unknown[]) => mockGetContent(...args) },
      issues: { createComment: (...args: unknown[]) => mockCreateComment(...args) },
    },
  }),
  context: mockContext,
}));

vi.mock('../src/anchor-validator.js', () => ({
  validateAnchors: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/summary-reporter.js', () => ({
  buildSummaryComment: vi.fn().mockReturnValue('## Summary'),
}));

import { validateAnchors } from '../src/anchor-validator.js';
import { buildSummaryComment } from '../src/summary-reporter.js';

// ── Helpers ──────────────────────────────────────────────────────────

function base64(str: string): string {
  return Buffer.from(str).toString('base64');
}

const validSidecar = JSON.stringify({
  $schema: 'https://gitnotate.dev/schemas/sidecar-v1.json',
  version: '1.0',
  file: 'src/utils.ts',
  annotations: [
    {
      id: 'ann-1',
      target: { exact: 'hello world' },
      author: { github: 'alice' },
      body: 'Nice!',
      created: '2024-01-01T00:00:00Z',
      resolved: false,
      replies: [],
    },
  ],
});

// ── Tests ────────────────────────────────────────────────────────────

describe('github-action run()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInput.mockReturnValue('fake-token');
    // Reset context to PR event
    mockContext.payload = {
      pull_request: { number: 42, head: { sha: 'abc123' } },
    };
  });

  async function runAction(): Promise<void> {
    // Re-import to trigger run() — dynamic import with cache busting
    vi.resetModules();

    // Re-apply mocks after resetModules
    vi.doMock('@actions/core', () => ({
      getInput: (...args: unknown[]) => mockGetInput(...args),
      info: (...args: unknown[]) => mockInfo(...args),
      warning: (...args: unknown[]) => mockWarning(...args),
      setFailed: (...args: unknown[]) => mockSetFailed(...args),
    }));

    vi.doMock('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: { listFiles: (...args: unknown[]) => mockListFiles(...args) },
          repos: { getContent: (...args: unknown[]) => mockGetContent(...args) },
          issues: { createComment: (...args: unknown[]) => mockCreateComment(...args) },
        },
      }),
      context: mockContext,
    }));

    vi.doMock('../src/anchor-validator.js', () => ({
      validateAnchors: (...args: unknown[]) => (validateAnchors as Function)(...args),
    }));

    vi.doMock('../src/summary-reporter.js', () => ({
      buildSummaryComment: (...args: unknown[]) => (buildSummaryComment as Function)(...args),
    }));

    const { runPromise } = await import('../src/index.js');
    await runPromise;
  }

  it('should skip when not a pull request event', async () => {
    mockContext.payload = {};

    await runAction();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Not a pull request'),
    );
    expect(mockListFiles).not.toHaveBeenCalled();
  });

  it('should skip when no sidecar files changed', async () => {
    mockListFiles.mockResolvedValue({
      data: [
        { filename: 'src/utils.ts', status: 'modified' },
        { filename: 'README.md', status: 'modified' },
      ],
    });

    await runAction();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('No sidecar comment files'),
    );
  });

  it('should warn when sidecar file content is missing', async () => {
    mockListFiles.mockResolvedValue({
      data: [{ filename: '.comments/src/utils.ts.json', status: 'added' }],
    });

    // getContent returns a directory listing (no content field)
    mockGetContent.mockResolvedValue({
      data: { type: 'dir', name: 'utils.ts.json' },
    });

    await runAction();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Could not read content'),
    );
  });

  it('should warn on schema validation failure', async () => {
    mockListFiles.mockResolvedValue({
      data: [{ filename: '.comments/src/utils.ts.json', status: 'added' }],
    });

    const invalidSidecar = JSON.stringify({ version: '999', file: '' });
    mockGetContent.mockResolvedValue({
      data: { content: base64(invalidSidecar), encoding: 'base64' },
    });

    await runAction();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Schema validation failed'),
    );
  });

  it('should warn when target file is not found', async () => {
    mockListFiles.mockResolvedValue({
      data: [{ filename: '.comments/src/utils.ts.json', status: 'added' }],
    });

    // First getContent call: sidecar file
    mockGetContent.mockResolvedValueOnce({
      data: { content: base64(validSidecar), encoding: 'base64' },
    });

    // Second getContent call: target file — 404
    mockGetContent.mockRejectedValueOnce(new Error('Not Found'));

    await runAction();

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('not found'),
    );
  });

  it('should validate anchors and post summary comment', async () => {
    mockListFiles.mockResolvedValue({
      data: [{ filename: '.comments/src/utils.ts.json', status: 'added' }],
    });

    mockGetContent
      .mockResolvedValueOnce({
        data: { content: base64(validSidecar), encoding: 'base64' },
      })
      .mockResolvedValueOnce({
        data: { content: base64('const hello = "hello world";'), encoding: 'base64' },
      });

    const mockResults = [
      { annotationId: 'ann-1', filePath: 'src/utils.ts', status: 'valid', message: 'Anchor intact' },
    ];
    vi.mocked(validateAnchors).mockResolvedValue(mockResults);
    vi.mocked(buildSummaryComment).mockReturnValue('## Summary\nAll anchors valid');

    await runAction();

    expect(validateAnchors).toHaveBeenCalledWith(
      '.comments/src/utils.ts.json',
      validSidecar,
      'const hello = "hello world";',
    );
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: expect.stringContaining('Summary'),
      }),
    );
  });

  it('should set failed when broken anchors are found', async () => {
    mockListFiles.mockResolvedValue({
      data: [{ filename: '.comments/src/utils.ts.json', status: 'added' }],
    });

    mockGetContent
      .mockResolvedValueOnce({
        data: { content: base64(validSidecar), encoding: 'base64' },
      })
      .mockResolvedValueOnce({
        data: { content: base64('different content'), encoding: 'base64' },
      });

    vi.mocked(validateAnchors).mockResolvedValue([
      { annotationId: 'ann-1', filePath: 'src/utils.ts', status: 'broken', message: 'Text not found' },
    ]);

    await runAction();

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('broken'),
    );
  });

  it('should handle top-level errors gracefully', async () => {
    mockGetInput.mockImplementation(() => {
      throw new Error('Input required: github-token');
    });

    await runAction();

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Action failed'),
    );
  });

  it('should continue processing other sidecar files when one getContent throws (I-15)', async () => {
    mockListFiles.mockResolvedValue({
      data: [
        { filename: '.comments/src/a.ts.json', status: 'added' },
        { filename: '.comments/src/b.ts.json', status: 'added' },
      ],
    });

    // First sidecar getContent throws, second succeeds
    mockGetContent
      .mockRejectedValueOnce(new Error('Network error fetching sidecar A'))
      .mockResolvedValueOnce({
        data: { content: base64(validSidecar), encoding: 'base64' },
      })
      .mockResolvedValueOnce({
        data: { content: base64('const x = 1;'), encoding: 'base64' },
      });

    vi.mocked(validateAnchors).mockResolvedValue([
      { annotationId: 'ann-1', filePath: 'src/utils.ts', status: 'valid', message: 'OK' },
    ]);
    vi.mocked(buildSummaryComment).mockReturnValue('## Summary');

    await runAction();

    // The second file should still be processed despite the first one failing
    expect(validateAnchors).toHaveBeenCalledTimes(1);
    // Should NOT call setFailed — action should continue gracefully
    expect(mockSetFailed).not.toHaveBeenCalled();
  });
});
