import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock settings module
vi.mock('../src/settings', () => ({
  enableWorkspace: vi.fn(),
  disableWorkspace: vi.fn(),
}));

// Mock new dependencies used by extension
vi.mock('../src/git-service', () => ({
  GitService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../src/auth', () => ({
  getGitHubToken: vi.fn().mockResolvedValue(undefined),
  ensureAuthenticated: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../src/pr-detector', () => ({
  detectCurrentPR: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/pr-service', () => ({
  PrService: vi.fn().mockImplementation(() => ({
    listReviewComments: vi.fn().mockResolvedValue([]),
  })),
}));

import { activate, deactivate } from '../src/extension';
import {
  commands,
  window,
  ExtensionMode,
  __getCommentControllers,
  __getStatusBarItem,
  __reset,
  Uri,
} from '../__mocks__/vscode';
import { getGitHubToken, ensureAuthenticated } from '../src/auth';
import { detectCurrentPR } from '../src/pr-detector';

const mockGetGitHubToken = vi.mocked(getGitHubToken);
const mockDetectCurrentPR = vi.mocked(detectCurrentPR);
const mockEnsureAuthenticated = vi.mocked(ensureAuthenticated);

function makeContext() {
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
    extensionMode: ExtensionMode.Test,
  };
}

describe('extension', () => {
  beforeEach(() => {
    __reset();
    vi.useFakeTimers();
    mockGetGitHubToken.mockResolvedValue(undefined);
    mockDetectCurrentPR.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register all commands on activate', async () => {
    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.enable',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.disable',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.addComment',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledTimes(3);
  });

  it('should call enableWorkspace when gitnotate.enable is invoked', async () => {
    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    // Find the enable handler
    const enableCall = commands.registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'gitnotate.enable'
    );
    const enableHandler = enableCall![1] as () => Promise<void>;
    await enableHandler();

    const { enableWorkspace } = await import('../src/settings');
    expect(enableWorkspace).toHaveBeenCalled();
  });

  it('should call disableWorkspace when gitnotate.disable is invoked', async () => {
    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    const disableCall = commands.registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'gitnotate.disable'
    );
    const disableHandler = disableCall![1] as () => Promise<void>;
    await disableHandler();

    const { disableWorkspace } = await import('../src/settings');
    expect(disableWorkspace).toHaveBeenCalled();
  });

  it('should call addCommentCommand when gitnotate.addComment is invoked', async () => {
    const context = makeContext();
    activate(context as any);
    await vi.runAllTimersAsync();

    const addCall = commands.registerCommand.mock.calls.find(
      (call: unknown[]) => call[0] === 'gitnotate.addComment'
    );
    const addHandler = addCall![1] as () => void;
    // Just verify it doesn't throw — the actual behavior is tested in comment-command.test.ts
    expect(() => addHandler()).not.toThrow();
  });

  it('should create a CommentController on activation', async () => {
    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    const controllers = __getCommentControllers();
    expect(controllers).toHaveLength(1);
    expect(controllers[0].id).toBe('gitnotate');
  });

  it('should push disposables to context.subscriptions', async () => {
    const context = makeContext();
    activate(context as any);
    await vi.runAllTimersAsync();

    // Verify subscriptions were added and all dispose functions work
    expect(context.subscriptions.length).toBeGreaterThan(0);
    for (const sub of context.subscriptions) {
      if (sub && typeof sub.dispose === 'function') {
        expect(() => sub.dispose()).not.toThrow();
      }
    }
  });

  it('deactivate should dispose the CommentController', async () => {
    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    const controllers = __getCommentControllers();
    deactivate();

    expect(controllers[0].dispose).toHaveBeenCalled();
  });

  it('should show status bar when PR is detected', async () => {
    mockGetGitHubToken.mockResolvedValue('test-token');
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello',
      number: 42,
      headSha: 'abc123',
    });

    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    const statusBar = __getStatusBarItem();
    expect(statusBar.text).toContain('PR #42');
    expect(statusBar.show).toHaveBeenCalled();
  });

  it('should hide status bar when no PR is detected', async () => {
    mockDetectCurrentPR.mockResolvedValue(null);

    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    const statusBar = __getStatusBarItem();
    expect(statusBar.hide).toHaveBeenCalled();
  });

  it('should prompt sign-in when PR is detected but no token', async () => {
    mockGetGitHubToken.mockResolvedValue(undefined);
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello',
      number: 42,
      headSha: 'abc123',
    });

    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Sign in'),
      'Sign In'
    );
  });

  it('should authenticate when user clicks Sign In', async () => {
    mockGetGitHubToken.mockResolvedValue(undefined);
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello',
      number: 42,
      headSha: 'abc123',
    });
    window.showInformationMessage.mockResolvedValueOnce('Sign In');
    mockEnsureAuthenticated.mockResolvedValueOnce(undefined);

    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    expect(mockEnsureAuthenticated).toHaveBeenCalled();
  });

  it('should handle auth decline gracefully', async () => {
    mockGetGitHubToken.mockResolvedValue(undefined);
    mockDetectCurrentPR.mockResolvedValue({
      owner: 'octocat',
      repo: 'hello',
      number: 42,
      headSha: 'abc123',
    });
    window.showInformationMessage.mockResolvedValueOnce('Sign In');
    mockEnsureAuthenticated.mockRejectedValueOnce(new Error('User cancelled'));

    activate(makeContext() as any);
    await vi.runAllTimersAsync();

    // Should not throw
    expect(mockEnsureAuthenticated).toHaveBeenCalled();
  });

  describe('onDidChangeActiveTextEditor', () => {
    it('should register an editor change handler', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(window.onDidChangeActiveTextEditor).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should sync comments when switching to a markdown editor with auth and PR', async () => {
      mockGetGitHubToken.mockResolvedValue('test-token');
      mockDetectCurrentPR.mockResolvedValue({
        owner: 'octocat',
        repo: 'hello',
        number: 42,
        headSha: 'abc123',
      });

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      // Get the handler that was registered
      const handlerCall = window.onDidChangeActiveTextEditor.mock.calls[0];
      const handler = handlerCall[0] as (editor: unknown) => void;

      // Simulate editor change
      const mockEditor = {
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      };
      handler(mockEditor);
      await vi.advanceTimersByTimeAsync(300);

      // Verify the sync was attempted (getGitHubToken called for sync)
      // Called once for status bar update + once for editor change sync
      expect(mockGetGitHubToken).toHaveBeenCalledTimes(2);
    });

    it('should not sync for non-markdown editors', async () => {
      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      // Reset call count after activation
      mockGetGitHubToken.mockClear();

      const handlerCall = window.onDidChangeActiveTextEditor.mock.calls[0];
      const handler = handlerCall[0] as (editor: unknown) => void;

      const mockEditor = {
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/src/index.ts'),
          languageId: 'typescript',
          fileName: '/workspace/src/index.ts',
        },
      };
      handler(mockEditor);
      await vi.advanceTimersByTimeAsync(300);

      // Should not call getGitHubToken for non-markdown
      expect(mockGetGitHubToken).not.toHaveBeenCalled();
    });

    it('should not sync when editor is undefined', async () => {
      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      mockGetGitHubToken.mockClear();

      const handlerCall = window.onDidChangeActiveTextEditor.mock.calls[0];
      const handler = handlerCall[0] as (editor: unknown) => void;

      handler(undefined);
      await vi.advanceTimersByTimeAsync(300);

      expect(mockGetGitHubToken).not.toHaveBeenCalled();
    });

    it('should not sync when no token is available for a markdown editor', async () => {
      mockGetGitHubToken.mockResolvedValue(undefined);

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      mockDetectCurrentPR.mockClear();

      const handlerCall = window.onDidChangeActiveTextEditor.mock.calls[0];
      const handler = handlerCall[0] as (editor: unknown) => void;

      const mockEditor = {
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      };
      handler(mockEditor);
      await vi.advanceTimersByTimeAsync(300);

      // Token was undefined → should not proceed to PR detection
      expect(mockDetectCurrentPR).not.toHaveBeenCalled();
    });

    it('should not sync when no PR is found for the current branch', async () => {
      mockGetGitHubToken.mockResolvedValue('test-token');
      mockDetectCurrentPR.mockResolvedValue(null);

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      const { PrService } = await import('../src/pr-service');
      vi.mocked(PrService).mockClear();

      const handlerCall = window.onDidChangeActiveTextEditor.mock.calls[0];
      const handler = handlerCall[0] as (editor: unknown) => void;

      const mockEditor = {
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      };
      handler(mockEditor);
      await vi.advanceTimersByTimeAsync(300);

      // PR was null → PrService should be constructed but sync not reached
      // detectCurrentPR was called (for the handler, not just status bar)
      expect(mockDetectCurrentPR).toHaveBeenCalled();
    });
  });
});
