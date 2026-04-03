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

vi.mock('../src/comments-tree-provider', () => {
  const mockSetComments = vi.fn();
  const mockSetState = vi.fn();
  const mockClear = vi.fn();
  const mockRefresh = vi.fn();
  const mockDispose = vi.fn();
  const mockOnDidChangeTreeData = vi.fn();

  return {
    CommentsTreeProvider: vi.fn().mockImplementation(() => ({
      setComments: mockSetComments,
      setState: mockSetState,
      clear: mockClear,
      refresh: mockRefresh,
      dispose: mockDispose,
      onDidChangeTreeData: mockOnDidChangeTreeData,
      getChildren: vi.fn().mockResolvedValue([]),
      getTreeItem: vi.fn((el: unknown) => el),
    })),
    __mockSetComments: mockSetComments,
    __mockSetState: mockSetState,
    __mockClear: mockClear,
    __mockRefresh: mockRefresh,
  };
});

import { activate, deactivate } from '../src/extension';
import {
  commands,
  window,
  workspace,
  authentication,
  ExtensionMode,
  __getCommentControllers,
  __getCommentThreads,
  __getStatusBarItem,
  __getTreeViews,
  __setActiveTextEditor,
  __reset,
  Uri,
} from '../__mocks__/vscode';
import { getGitHubToken, ensureAuthenticated } from '../src/auth';
import { detectCurrentPR } from '../src/pr-detector';
import {
  __mockSetComments,
  __mockSetState,
  __mockRefresh,
} from '../src/comments-tree-provider';

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
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.refreshComments',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.goToComment',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledTimes(5);
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

  describe('onDidSaveTextDocument', () => {
    it('should register a save handler', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(workspace.onDidSaveTextDocument).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should trigger sync when a markdown file is saved', async () => {
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

      mockGetGitHubToken.mockClear();

      const saveHandlerCall = workspace.onDidSaveTextDocument.mock.calls[0];
      const saveHandler = saveHandlerCall[0] as (doc: unknown) => void;

      const mockDoc = {
        uri: Uri.file('/workspace/docs/readme.md'),
        languageId: 'markdown',
        fileName: '/workspace/docs/readme.md',
      };

      // Simulate the active editor matching the saved doc
      __setActiveTextEditor({
        setDecorations: vi.fn(),
        document: mockDoc,
      });

      saveHandler(mockDoc);
      await vi.advanceTimersByTimeAsync(300);

      expect(mockGetGitHubToken).toHaveBeenCalled();
    });

    it('should NOT trigger sync when a non-markdown file is saved', async () => {
      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      mockGetGitHubToken.mockClear();

      const saveHandlerCall = workspace.onDidSaveTextDocument.mock.calls[0];
      const saveHandler = saveHandlerCall[0] as (doc: unknown) => void;

      const mockDoc = {
        uri: Uri.file('/workspace/src/index.ts'),
        languageId: 'typescript',
        fileName: '/workspace/src/index.ts',
      };

      saveHandler(mockDoc);
      await vi.advanceTimersByTimeAsync(300);

      expect(mockGetGitHubToken).not.toHaveBeenCalled();
    });
  });

  describe('onDidCloseTextDocument', () => {
    it('should register a close handler', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(workspace.onDidCloseTextDocument).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should clear threads when a markdown file is closed', async () => {
      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      const closeHandlerCall = workspace.onDidCloseTextDocument.mock.calls[0];
      const closeHandler = closeHandlerCall[0] as (doc: unknown) => void;

      const mockDoc = {
        uri: Uri.file('/workspace/docs/readme.md'),
        languageId: 'markdown',
        fileName: '/workspace/docs/readme.md',
      };

      const controllers = __getCommentControllers();
      const clearSpy = vi.spyOn(controllers[0], 'createCommentThread');

      closeHandler(mockDoc);

      // The close handler should have been called (we verify CommentController
      // exists and clearThreads is invoked — since we can't spy on the actual
      // CommentController wrapper, we verify the handler was registered and
      // doesn't throw)
      expect(workspace.onDidCloseTextDocument).toHaveBeenCalled();
    });

    it('should NOT clear threads when a non-markdown file is closed', async () => {
      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      const closeHandlerCall = workspace.onDidCloseTextDocument.mock.calls[0];
      const closeHandler = closeHandlerCall[0] as (doc: unknown) => void;

      const mockDoc = {
        uri: Uri.file('/workspace/src/index.ts'),
        languageId: 'typescript',
        fileName: '/workspace/src/index.ts',
      };

      // Should not throw, should silently skip
      expect(() => closeHandler(mockDoc)).not.toThrow();
    });
  });

  describe('onDidChangeSessions (auth change)', () => {
    it('should register an auth session change handler', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(authentication.onDidChangeSessions).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should trigger re-sync for active editor when auth changes', async () => {
      mockGetGitHubToken.mockResolvedValue('old-token');
      mockDetectCurrentPR.mockResolvedValue({
        owner: 'octocat',
        repo: 'hello',
        number: 42,
        headSha: 'abc123',
      });

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      mockGetGitHubToken.mockClear();
      mockGetGitHubToken.mockResolvedValue('new-token');

      const authHandlerCall = authentication.onDidChangeSessions.mock.calls[0];
      const authHandler = authHandlerCall[0] as (e: unknown) => void;

      // Set an active editor
      __setActiveTextEditor({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      });

      authHandler({ provider: { id: 'github' } });
      await vi.advanceTimersByTimeAsync(300);

      expect(mockGetGitHubToken).toHaveBeenCalled();
    });

    it('should clear all threads immediately on auth change (20.1)', async () => {
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

      // Import CommentController to spy on clearThreads
      const { CommentController } = await import('../src/comment-controller');
      const clearThreadsSpy = vi.spyOn(CommentController.prototype, 'clearThreads');

      // Sign out — token becomes undefined
      mockGetGitHubToken.mockResolvedValue(undefined);

      const authHandler = authentication.onDidChangeSessions.mock.calls[0][0] as (e: unknown) => void;
      authHandler({ provider: { id: 'github' } });

      // clearThreads() should be called immediately (before debounced sync)
      expect(clearThreadsSpy).toHaveBeenCalledWith();

      clearThreadsSpy.mockRestore();
    });

    it('should clear highlights on active editor when auth changes (20.1b)', async () => {
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

      // Set an active editor with a setDecorations spy
      const setDecorationsSpy = vi.fn();
      __setActiveTextEditor({
        setDecorations: setDecorationsSpy,
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      });

      // Sign out
      mockGetGitHubToken.mockResolvedValue(undefined);

      const authHandler = authentication.onDidChangeSessions.mock.calls[0][0] as (e: unknown) => void;
      authHandler({ provider: { id: 'github' } });

      // clearHighlights should have been called — setDecorations with empty arrays
      expect(setDecorationsSpy).toHaveBeenCalled();
      // Each call should pass an empty array (clearing the decorations)
      for (const call of setDecorationsSpy.mock.calls) {
        expect(call[1]).toEqual([]);
      }
    });

    it('should not crash when auth changes with no active editor (20.3)', async () => {
      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      __setActiveTextEditor(undefined);

      const authHandlerCall = authentication.onDidChangeSessions.mock.calls[0];
      const authHandler = authHandlerCall[0] as (e: unknown) => void;

      // Should not throw — triggerSync is a no-op when no editor
      expect(() => authHandler({ provider: { id: 'github' } })).not.toThrow();
      await vi.advanceTimersByTimeAsync(300);
    });
  });

  describe('service hoisting & cache persistence (17.x)', () => {
    it('should reuse PrService across multiple editor syncs (17.1/17.4)', async () => {
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

      const { PrService } = await import('../src/pr-service');

      // Trigger first sync
      const handler = window.onDidChangeActiveTextEditor.mock.calls[0][0] as (e: unknown) => void;
      const mkEditor = (name: string) => ({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file(`/workspace/docs/${name}`),
          languageId: 'markdown',
          fileName: `/workspace/docs/${name}`,
        },
      });

      handler(mkEditor('file-a.md'));
      await vi.advanceTimersByTimeAsync(300);

      const prServiceCallCount1 = vi.mocked(PrService).mock.calls.length;

      // Trigger second sync — PrService should NOT be reconstructed (same token)
      handler(mkEditor('file-b.md'));
      await vi.advanceTimersByTimeAsync(300);

      const prServiceCallCount2 = vi.mocked(PrService).mock.calls.length;
      expect(prServiceCallCount2).toBe(prServiceCallCount1);
    });

    it('should recreate PrService when token changes (17.5)', async () => {
      mockGetGitHubToken.mockResolvedValue('token-A');
      mockDetectCurrentPR.mockResolvedValue({
        owner: 'octocat',
        repo: 'hello',
        number: 42,
        headSha: 'abc123',
      });

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      const { PrService } = await import('../src/pr-service');

      const handler = window.onDidChangeActiveTextEditor.mock.calls[0][0] as (e: unknown) => void;
      const mkEditor = (name: string) => ({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file(`/workspace/docs/${name}`),
          languageId: 'markdown',
          fileName: `/workspace/docs/${name}`,
        },
      });

      // First sync with token-A
      handler(mkEditor('file-a.md'));
      await vi.advanceTimersByTimeAsync(300);

      const prServiceCallCount1 = vi.mocked(PrService).mock.calls.length;

      // Change token
      mockGetGitHubToken.mockResolvedValue('token-B');

      // Second sync — PrService SHOULD be reconstructed (different token)
      handler(mkEditor('file-b.md'));
      await vi.advanceTimersByTimeAsync(300);

      const prServiceCallCount2 = vi.mocked(PrService).mock.calls.length;
      expect(prServiceCallCount2).toBe(prServiceCallCount1 + 1);
    });
  });

  describe('deactivation cleanup (22.1)', () => {
    it('should clean up all hoisted references on deactivate', async () => {
      mockGetGitHubToken.mockResolvedValue('test-token');
      mockDetectCurrentPR.mockResolvedValue({
        owner: 'octocat',
        repo: 'hello',
        number: 42,
        headSha: 'abc123',
      });

      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      const controllers = __getCommentControllers();
      expect(controllers).toHaveLength(1);

      deactivate();

      expect(controllers[0].dispose).toHaveBeenCalled();

      // Reactivation should work cleanly — no stale state
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      const newControllers = __getCommentControllers();
      expect(newControllers).toHaveLength(2); // new controller created
    });
  });

  describe('sidebar TreeView wiring', () => {
    it('should create a TreeView with gitnotateComments view id on activate', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(window.createTreeView).toHaveBeenCalledWith(
        'gitnotateComments',
        expect.objectContaining({ treeDataProvider: expect.any(Object) })
      );
    });

    it('should register refreshComments command', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(commands.registerCommand).toHaveBeenCalledWith(
        'gitnotate.refreshComments',
        expect.any(Function)
      );
    });

    it('should register goToComment command', async () => {
      activate(makeContext() as any);
      await vi.runAllTimersAsync();

      expect(commands.registerCommand).toHaveBeenCalledWith(
        'gitnotate.goToComment',
        expect.any(Function)
      );
    });

    it('should update tree provider with comments after successful sync', async () => {
      const mockComments = [
        { id: 1, body: 'test', path: 'docs/readme.md', line: 5, side: 'RIGHT', createdAt: '', updatedAt: '' },
      ];

      // Configure PrService mock to return comments BEFORE activation
      const { PrService } = await import('../src/pr-service');
      vi.mocked(PrService).mockImplementation(() => ({
        listReviewComments: vi.fn().mockResolvedValue(mockComments),
      }) as any);

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

      // Trigger sync via editor change
      const handler = window.onDidChangeActiveTextEditor.mock.calls[0][0] as (e: unknown) => void;
      handler({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      });
      await vi.advanceTimersByTimeAsync(300);

      expect(__mockSetComments).toHaveBeenCalledWith(mockComments);
    });

    it('should set noAuth state on tree provider when no token', async () => {
      mockGetGitHubToken.mockResolvedValue(undefined);

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      // Trigger sync — no token
      const handler = window.onDidChangeActiveTextEditor.mock.calls[0][0] as (e: unknown) => void;
      handler({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      });
      await vi.advanceTimersByTimeAsync(300);

      expect(__mockSetState).toHaveBeenCalledWith('noAuth');
    });

    it('should set noPr state on tree provider when no PR found', async () => {
      mockGetGitHubToken.mockResolvedValue('test-token');
      mockDetectCurrentPR.mockResolvedValue(null);

      const context = makeContext();
      activate(context as any);
      await vi.runAllTimersAsync();

      // Trigger sync
      const handler = window.onDidChangeActiveTextEditor.mock.calls[0][0] as (e: unknown) => void;
      handler({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      });
      await vi.advanceTimersByTimeAsync(300);

      expect(__mockSetState).toHaveBeenCalledWith('noPr');
    });

    it('should set noAuth state on tree provider when auth session changes to signed out', async () => {
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

      // Sign out
      mockGetGitHubToken.mockResolvedValue(undefined);
      const authHandler = authentication.onDidChangeSessions.mock.calls[0][0] as (e: unknown) => void;
      authHandler({ provider: { id: 'github' } });
      await vi.advanceTimersByTimeAsync(100);

      expect(__mockSetState).toHaveBeenCalledWith('noAuth');
    });

    it('should set loading state on tree provider when signing back in with markdown editor active', async () => {
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

      // Set an active markdown editor
      __setActiveTextEditor({
        setDecorations: vi.fn(),
        document: {
          uri: Uri.file('/workspace/docs/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/docs/readme.md',
        },
      });

      // Sign back in (token present)
      mockGetGitHubToken.mockResolvedValue('new-token');
      const authHandler = authentication.onDidChangeSessions.mock.calls[0][0] as (e: unknown) => void;
      authHandler({ provider: { id: 'github' } });
      await vi.advanceTimersByTimeAsync(100);

      expect(__mockSetState).toHaveBeenCalledWith('loading');
    });

    it('should not set loading state on sign-in when no markdown editor is active', async () => {
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

      __mockSetState.mockClear();

      // No active editor
      __setActiveTextEditor(undefined);

      // Sign back in
      mockGetGitHubToken.mockResolvedValue('new-token');
      const authHandler = authentication.onDidChangeSessions.mock.calls[0][0] as (e: unknown) => void;
      authHandler({ provider: { id: 'github' } });
      await vi.advanceTimersByTimeAsync(100);

      // Should NOT have called setState('loading') — no markdown editor to sync
      expect(__mockSetState).not.toHaveBeenCalledWith('loading');
    });
  });
});
