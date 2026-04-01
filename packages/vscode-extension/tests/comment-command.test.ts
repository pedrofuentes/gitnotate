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

import {
  window,
  Position,
  Range,
  __setActiveTextEditor,
  __reset,
} from '../__mocks__/vscode';
import { addCommentCommand } from '../src/comment-command';
import { PrService } from '../src/pr-service';
import { detectCurrentPR } from '../src/pr-detector';
import { buildGnComment } from '@gitnotate/core';
import { getGitHubToken } from '../src/auth';

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

    const mockCreateReviewComment = vi.fn().mockResolvedValue({ ok: true });
<<<<<<< HEAD
    vi.mocked(GitHubApiClient).mockImplementation(
=======
    vi.mocked(PrService).mockImplementation(
>>>>>>> feature/comment-controller-thread-sync
      () => ({ createReviewComment: mockCreateReviewComment, listReviewComments: vi.fn() } as any)
    );

    await addCommentCommand(mockContext);

    expect(mockCreateReviewComment).toHaveBeenCalledWith(
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

<<<<<<< HEAD
    vi.mocked(GitHubApiClient).mockImplementation(
=======
    vi.mocked(PrService).mockImplementation(
>>>>>>> feature/comment-controller-thread-sync
      () => ({ createReviewComment: vi.fn().mockResolvedValue({ ok: true }), listReviewComments: vi.fn() } as any)
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

<<<<<<< HEAD
    vi.mocked(GitHubApiClient).mockImplementation(
=======
    vi.mocked(PrService).mockImplementation(
>>>>>>> feature/comment-controller-thread-sync
      () => ({ createReviewComment: vi.fn().mockResolvedValue({ ok: false, userMessage: 'Permission denied.' }), listReviewComments: vi.fn() } as any)
    );

    await addCommentCommand(mockContext);

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied')
    );
  });
});
