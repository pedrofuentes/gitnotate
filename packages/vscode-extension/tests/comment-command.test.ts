import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock modules before importing them
vi.mock('../src/pr-service', () => ({
  PrService: vi.fn().mockImplementation(() => ({
    createReviewComment: vi.fn(),
  })),
}));

vi.mock('../src/pr-detector', () => ({
  detectCurrentPR: vi.fn(),
}));

vi.mock('../src/git-service', () => ({
  GitService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../src/auth', () => ({
  getGitHubToken: vi.fn(),
}));

vi.mock('@gitnotate/core', () => ({
  buildGnComment: vi.fn(),
}));

vi.mock('../src/side-utils', () => ({
  detectDocumentSide: vi.fn(),
}));

vi.mock('../src/logger', () => ({
  debug: vi.fn(),
}));

import {
  window,
  Uri,
  Range,
  __setActiveTextEditor,
  __reset,
} from '../__mocks__/vscode';
import { addCommentCommand } from '../src/comment-command';
import { PrService } from '../src/pr-service';
import { detectCurrentPR } from '../src/pr-detector';
import { buildGnComment } from '@gitnotate/core';
import { getGitHubToken } from '../src/auth';
import { detectDocumentSide } from '../src/side-utils';
import { debug } from '../src/logger';

const mockDetectDocumentSide = vi.mocked(detectDocumentSide);
const mockDebug = vi.mocked(debug);

const mockDetectCurrentPR = vi.mocked(detectCurrentPR);
const mockBuildGnComment = vi.mocked(buildGnComment);
const mockGetGitHubToken = vi.mocked(getGitHubToken);

describe('addCommentCommand', () => {
  const mockContext = {
    subscriptions: [],
    extensionUri: { fsPath: '/ext' },
  } as any;

  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show error if no active editor', async () => {
    __setActiveTextEditor(undefined);

    await addCommentCommand(mockContext);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Select text first')
    );
    expect(mockGetGitHubToken).not.toHaveBeenCalled();
    expect(mockDetectCurrentPR).not.toHaveBeenCalled();
    expect(mockBuildGnComment).not.toHaveBeenCalled();
    expect(window.showInputBox).not.toHaveBeenCalled();
  });

  it('should show error if no selection', async () => {
    __setActiveTextEditor({
      selection: new Range(5, 0, 5, 0), // empty selection
      document: {
        getText: vi.fn().mockReturnValue(''),
        uri: { fsPath: '/project/src/file.ts' },
        lineAt: vi.fn().mockReturnValue({ text: 'some line content' }),
        fileName: '/project/src/file.ts',
      },
    });

    await addCommentCommand(mockContext);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Select text first')
    );
    expect(mockGetGitHubToken).not.toHaveBeenCalled();
    expect(mockDetectCurrentPR).not.toHaveBeenCalled();
    expect(mockBuildGnComment).not.toHaveBeenCalled();
    expect(window.showInputBox).not.toHaveBeenCalled();
  });

  it('should show error if no PR is detected', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');
    mockDetectCurrentPR.mockResolvedValue(null);

    await addCommentCommand(mockContext);

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('No pull request')
    );
    expect(mockBuildGnComment).not.toHaveBeenCalled();
    expect(window.showInputBox).not.toHaveBeenCalled();
  });

  it('should show error if no GitHub token configured', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue(undefined);

    await addCommentCommand(mockContext);

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('GitHub authentication')
    );
    expect(mockDetectCurrentPR).not.toHaveBeenCalled();
    expect(mockBuildGnComment).not.toHaveBeenCalled();
    expect(window.showInputBox).not.toHaveBeenCalled();
  });

  it('should prompt for comment text via input box', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected text'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    });
    window.showInputBox.mockResolvedValue(undefined); // user cancelled

    await addCommentCommand(mockContext);

    expect(window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('comment'),
      })
    );
  });

  it('should do nothing when user cancels input box', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected text'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    });
    window.showInputBox.mockResolvedValue(undefined);

    await addCommentCommand(mockContext);

    expect(window.showInformationMessage).not.toHaveBeenCalledWith(
      expect.stringContaining('Comment posted')
    );
    expect(mockBuildGnComment).not.toHaveBeenCalled();
  });

  it('should build ^gn comment body from selection', async () => {
    const selection = new Range(5, 2, 5, 10);
    const mockEditor = {
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    };
    __setActiveTextEditor(mockEditor);
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');

    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    });
    window.showInputBox.mockResolvedValue('Great code!');
    mockBuildGnComment.mockReturnValue('<!-- ^gn {} -->\n> quote\n\nGreat code!');

    const mockApiInstance = {
      createReviewWithComment: vi.fn().mockResolvedValue({ ok: true, id: 1 }),
      createReviewComment: vi.fn().mockResolvedValue({ ok: true }),
    };
    vi.mocked(PrService).mockImplementation(() => mockApiInstance as any);

    await addCommentCommand(mockContext);

    expect(mockBuildGnComment).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: 'selected',
        start: 2,
        end: 10,
      }),
      'Great code!'
    );
  });

  it('should call API with correct parameters', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');

    const prInfo = {
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    };
    mockDetectCurrentPR.mockResolvedValue(prInfo);
    window.showInputBox.mockResolvedValue('Nice!');
    mockBuildGnComment.mockReturnValue('formatted comment body');

    const mockCreateReviewWithComment = vi.fn().mockResolvedValue({ ok: true, id: 1 });
    vi.mocked(PrService).mockImplementation(
      () => ({ createReviewWithComment: mockCreateReviewWithComment, createReviewComment: vi.fn(), listReviewComments: vi.fn() } as any)
    );

    await addCommentCommand(mockContext);

    expect(mockCreateReviewWithComment).toHaveBeenCalledWith(
      prInfo,
      expect.stringContaining('file.ts'),
      6, // line is 0-indexed in VSCode, 1-indexed in GitHub API
      'RIGHT',
      'formatted comment body'
    );
  });

  it('should show success message on successful comment', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    });
    window.showInputBox.mockResolvedValue('Nice!');
    mockBuildGnComment.mockReturnValue('comment body');

    vi.mocked(PrService).mockImplementation(
      () => ({ createReviewWithComment: vi.fn().mockResolvedValue({ ok: true, id: 1 }), createReviewComment: vi.fn(), listReviewComments: vi.fn() } as any)
    );

    await addCommentCommand(mockContext);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Comment posted')
    );
  });

  it('should show error on API failure', async () => {
    const selection = new Range(5, 2, 5, 10);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('selected'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
      },
    });
    mockGetGitHubToken.mockResolvedValue('ghp_test_token');
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    });
    window.showInputBox.mockResolvedValue('Nice!');
    mockBuildGnComment.mockReturnValue('comment body');

    vi.mocked(PrService).mockImplementation(
      () => ({
        createReviewWithComment: vi.fn().mockResolvedValue({ ok: false, userMessage: 'Permission denied.' }),
        createReviewComment: vi.fn().mockResolvedValue({ ok: false, userMessage: 'Permission denied.' }),
        listReviewComments: vi.fn(),
      } as any)
    );

    await addCommentCommand(mockContext);

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied')
    );
  });

  // These tests verify that POSTING uses detectDocumentSide (not detectRenderingSide).
  // Rendering shows ALL comments (BOTH mode), but posting correctly detects LEFT/RIGHT
  // from the URI scheme so the ^gn metadata and GitHub API call use the right side.
  describe('side-aware comment posting', () => {
    const prInfo = {
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      headSha: 'abc123',
    };

    function setupEditor(uri: InstanceType<typeof Uri>) {
      const selection = new Range(5, 2, 5, 10);
      __setActiveTextEditor({
        selection,
        document: {
          getText: vi.fn().mockReturnValue('selected text'),
          uri,
          fileName: uri.fsPath,
        },
      });
      mockGetGitHubToken.mockResolvedValue('ghp_test_token');
      mockDetectCurrentPR.mockResolvedValue(prInfo);
      window.showInputBox.mockResolvedValue('Nice comment!');
      mockBuildGnComment.mockReturnValue('formatted comment body');
    }

    it('should use side R in metadata and RIGHT in API call for file: URI', async () => {
      const uri = Uri.file('/project/src/file.ts');
      setupEditor(uri);
      mockDetectDocumentSide.mockReturnValue('RIGHT');

      const mockCreateReviewComment = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: vi.fn().mockResolvedValue({ ok: false }), createReviewComment: mockCreateReviewComment, listReviewComments: vi.fn() } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockBuildGnComment).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'R' }),
        'Nice comment!'
      );
      expect(mockCreateReviewComment).toHaveBeenCalledWith(
        prInfo,
        expect.any(String),
        6,
        'RIGHT',
        'formatted comment body'
      );
    });

    it('should use side L in metadata and LEFT in API call for git: URI', async () => {
      const uri = Uri.from({ scheme: 'git', path: '/project/src/file.ts' });
      setupEditor(uri);
      mockDetectDocumentSide.mockReturnValue('LEFT');

      const mockCreateReviewComment = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: vi.fn().mockResolvedValue({ ok: false }), createReviewComment: mockCreateReviewComment, listReviewComments: vi.fn() } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockBuildGnComment).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'L' }),
        'Nice comment!'
      );
      expect(mockCreateReviewComment).toHaveBeenCalledWith(
        prInfo,
        expect.any(String),
        6,
        'LEFT',
        'formatted comment body'
      );
    });

    it('should default to side R/RIGHT for unknown URI scheme (BOTH)', async () => {
      const uri = Uri.parse('untitled:Untitled-1');
      setupEditor(uri);
      mockDetectDocumentSide.mockReturnValue('BOTH');

      const mockCreateReviewComment = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: vi.fn().mockResolvedValue({ ok: false }), createReviewComment: mockCreateReviewComment, listReviewComments: vi.fn() } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockBuildGnComment).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'R' }),
        'Nice comment!'
      );
      expect(mockCreateReviewComment).toHaveBeenCalledWith(
        prInfo,
        expect.any(String),
        6,
        'RIGHT',
        'formatted comment body'
      );
    });

    it('should include correct side value in ^gn tag in comment body', async () => {
      const uri = Uri.from({ scheme: 'git', path: '/project/src/file.ts' });
      setupEditor(uri);
      mockDetectDocumentSide.mockReturnValue('LEFT');

      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: vi.fn().mockResolvedValue({ ok: false }), createReviewComment: vi.fn().mockResolvedValue({ ok: true }), listReviewComments: vi.fn() } as any)
      );

      await addCommentCommand(mockContext);

      const metadataArg = mockBuildGnComment.mock.calls[0][0];
      expect(metadataArg).toMatchObject({
        exact: 'selected text',
        lineNumber: 6,
        side: 'L',
        start: 2,
        end: 10,
      });
    });

    it('should show detected side in debug log', async () => {
      const uri = Uri.from({ scheme: 'git', path: '/project/src/file.ts' });
      setupEditor(uri);
      mockDetectDocumentSide.mockReturnValue('LEFT');

      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: vi.fn().mockResolvedValue({ ok: false }), createReviewComment: vi.fn().mockResolvedValue({ ok: true }), listReviewComments: vi.fn() } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockDebug).toHaveBeenCalledWith(
        'Add Comment:',
        expect.objectContaining({ side: 'LEFT' })
      );
    });
  });

  describe('review endpoint fallback', () => {
    function setupStandardScenario() {
      const selection = new Range(5, 2, 5, 10);
      __setActiveTextEditor({
        selection,
        document: {
          getText: vi.fn().mockReturnValue('selected'),
          uri: { fsPath: '/project/src/file.ts' },
          fileName: '/project/src/file.ts',
        },
      });
      mockGetGitHubToken.mockResolvedValue('ghp_test_token');
      mockDetectCurrentPR.mockResolvedValue({
        owner: 'octocat',
        repo: 'hello-world',
        number: 42,
        headSha: 'abc123',
      });
      window.showInputBox.mockResolvedValue('Nice!');
      mockBuildGnComment.mockReturnValue('formatted comment body');
    }

    it('should try createReviewWithComment first', async () => {
      setupStandardScenario();

      const mockCreateReviewWithComment = vi.fn().mockResolvedValue({ ok: true, id: 100 });
      const mockCreateReviewComment = vi.fn();
      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: mockCreateReviewWithComment, createReviewComment: mockCreateReviewComment } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockCreateReviewWithComment).toHaveBeenCalledOnce();
    });

    it('should fall back to createReviewComment when createReviewWithComment fails', async () => {
      setupStandardScenario();

      const mockCreateReviewWithComment = vi.fn().mockResolvedValue({ ok: false, userMessage: 'Review error' });
      const mockCreateReviewComment = vi.fn().mockResolvedValue({ ok: true });
      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: mockCreateReviewWithComment, createReviewComment: mockCreateReviewComment } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockCreateReviewWithComment).toHaveBeenCalledOnce();
      expect(mockCreateReviewComment).toHaveBeenCalledOnce();
    });

    it('should not call createReviewComment when createReviewWithComment succeeds', async () => {
      setupStandardScenario();

      const mockCreateReviewWithComment = vi.fn().mockResolvedValue({ ok: true, id: 100 });
      const mockCreateReviewComment = vi.fn();
      vi.mocked(PrService).mockImplementation(
        () => ({ createReviewWithComment: mockCreateReviewWithComment, createReviewComment: mockCreateReviewComment } as any)
      );

      await addCommentCommand(mockContext);

      expect(mockCreateReviewComment).not.toHaveBeenCalled();
    });
  });
});
