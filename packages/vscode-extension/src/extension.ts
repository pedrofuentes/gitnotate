import * as vscode from 'vscode';
import * as path from 'path';
import { enableWorkspace, disableWorkspace } from './settings';
import { addCommentCommand } from './comment-command';
import { detectCurrentPR } from './pr-detector';
import { GitService } from './git-service';
import { getGitHubToken, ensureAuthenticated } from './auth';
import { initLogger, debug, createLogger, getLogger } from './logger';
import { CommentController } from './comment-controller';
import { CommentThreadSync } from './comment-thread-sync';
import { AnchorTracker } from './anchor-tracker';
import { PrService } from './pr-service';
import { getRelativePath, debounce } from './utils';
import { CommentsTreeProvider } from './comments-tree-provider';
import { StatusBarManager } from './status-bar';
import { showAuthError } from './error-handler';

let commentCtrl: CommentController | undefined;
let statusBar: StatusBarManager | undefined;
let prService: PrService | undefined;
let threadSync: CommentThreadSync | undefined;
let cachedToken: string | undefined;
let treeProvider: CommentsTreeProvider | undefined;
let anchorTracker: AnchorTracker | undefined;
let gitService: GitService | undefined;
let gitServiceWarningShown = false;

async function promptSignIn(): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    'Gitnotate: Sign in to GitHub to enable sub-line commenting on this PR.',
    'Sign In'
  );
  if (action === 'Sign In') {
    try {
      await ensureAuthenticated();
      debug('User signed in — refreshing PR status bar');
      await updatePRStatusBar();
    } catch {
      debug('User declined sign-in');
    }
  }
}

async function updatePRStatusBar(): Promise<void> {
  debug('Updating PR status bar...');
  const token = await getGitHubToken();
  debug('Auth token:', token ? 'present' : 'absent');

  if (!gitService || !statusBar) {
    debug('updatePRStatusBar: gitService or statusBar not available — skipping');
    return;
  }

  statusBar.setLoading();
  const pr = await detectCurrentPR(gitService, token);

  if (pr) {
    debug('PR detected:', `${pr.owner}/${pr.repo}#${pr.number}`);
    statusBar.show(pr.number);

    if (!token) {
      promptSignIn();
    }
  } else {
    debug('No PR detected — status bar hidden');
    statusBar.hide();
  }
}

export function activate(context: vscode.ExtensionContext) {
  initLogger(context);
  const log = createLogger();
  log.info('Extension', 'activating');
  debug('Extension activating...');

  statusBar = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBar?.dispose() });

  commentCtrl = new CommentController();
  context.subscriptions.push({ dispose: () => commentCtrl?.dispose() });

  anchorTracker = new AnchorTracker();
  anchorTracker.activate();
  context.subscriptions.push({ dispose: () => anchorTracker?.dispose() });

  gitService = new GitService();

  treeProvider = new CommentsTreeProvider();
  const treeView = vscode.window.createTreeView('gitnotateComments', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  treeProvider.registerTreeView(treeView);
  context.subscriptions.push(treeView);
  context.subscriptions.push({ dispose: () => treeProvider?.dispose() });

  commentCtrl.onThreadRevealed = (commentId) => {
    treeProvider?.revealByCommentId(commentId);
  };

  const debouncedSync = debounce(async (editor: vscode.TextEditor) => {
    debug('Comment sync: editor changed →', editor.document.fileName, `(${editor.document.languageId})`);
    if (editor.document.languageId !== 'markdown') {
      debug('Comment sync: not markdown — skipping');
      return;
    }

    // Skip VSCode comment input virtual documents (they're markdown but not real files)
    if (editor.document.uri.scheme === 'comment' || editor.document.fileName.includes('commentinput-')) {
      debug('Comment sync: comment input document — skipping');
      return;
    }

    const token = await getGitHubToken();
    if (!token) {
      debug('Comment sync: no auth token — skipping');
      treeProvider?.setState('noAuth');
      return;
    }

    if (token !== cachedToken || !prService || !threadSync) {
      cachedToken = token;
      prService = new PrService(token);
      if (!commentCtrl) return;
      threadSync = new CommentThreadSync(prService, commentCtrl, anchorTracker);
      debug('Comment sync: recreated PrService + CommentThreadSync (token changed)');
    }

    if (!gitService) {
      if (!gitServiceWarningShown) {
        gitServiceWarningShown = true;
        console.warn('Gitnotate: gitService not available — comment sync skipped');
      }
      debug('Comment sync: gitService not available — skipping');
      return;
    }
    const pr = await detectCurrentPR(gitService, token);
    if (!pr) {
      debug('Comment sync: no PR found — skipping');
      treeProvider?.setState('noPr');
      return;
    }

    if (!commentCtrl) return;
    const relativePath = getRelativePath(editor.document.fileName);
    debug('Comment sync: syncing', relativePath, `(PR #${pr.number})`);
    // Capture local reference — threadSync can be reset by other handlers during awaits
    const sync = threadSync;
    if (!sync) return;

    // Detect diff view via TabInputTextDiff API and get the two URIs.
    // IMPORTANT: In diff views, both editors may use the same scheme (e.g., both git:)
    // but with different query params. We use the Tab API to get the canonical
    // original/modified URIs, then find the matching editors.
    const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
    const isDiffView = activeTab?.input instanceof vscode.TabInputTextDiff;

    if (isDiffView) {
      const diffInput = activeTab.input as vscode.TabInputTextDiff;
      const originalUri = diffInput.original;
      const modifiedUri = diffInput.modified;

      debug('Comment sync: diff view detected');
      debug('  original URI:', originalUri.toString());
      debug('  modified URI:', modifiedUri.toString());

      // URI-based thread placement: each thread created on correct URI,
      // VSCode routes to correct pane automatically
      const diffResult = await sync.syncForDiff(originalUri, modifiedUri, relativePath, pr);

      // null means data unchanged — preserve current highlights
      if (diffResult !== null) {
        const { leftRanges, rightRanges } = diffResult;

        // Apply highlights to the matching visible editors
        for (const visibleEditor of vscode.window.visibleTextEditors) {
          const editorUri = visibleEditor.document.uri.toString();
          if (editorUri === originalUri.toString() && leftRanges.length > 0) {
            commentCtrl.applyHighlights(visibleEditor, leftRanges);
          } else if (editorUri === modifiedUri.toString() && rightRanges.length > 0) {
            commentCtrl.applyHighlights(visibleEditor, rightRanges);
          }
        }
      }
    } else {
      // Single file view: show only RIGHT/New comments (current version)
      const highlightRanges = await sync.syncForDocument(editor.document.uri, relativePath, pr);

      // null means data unchanged — preserve current highlights
      if (highlightRanges !== null) {
        if (highlightRanges.length > 0) {
          commentCtrl.applyHighlights(editor, highlightRanges);
        } else {
          commentCtrl.clearHighlights(editor);
        }
      }
    }

    // Update sidebar tree with all comments from this PR
    const cachedComments = sync.getCachedComments(pr);
    if (cachedComments) {
      treeProvider?.setComments(cachedComments);
    }

    // Start polling for live updates (single-file view only — diff views
    // re-render on each debouncedSync; polling would clobber per-side threads)
    if (!isDiffView) {
      sync.startPolling(editor.document.uri, relativePath, pr);
    } else {
      sync.stopPolling();
    }
  }, 300);

  const triggerSync = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      debouncedSync(editor);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('gitnotate.enable', async () => {
      await enableWorkspace();
      vscode.window.showInformationMessage('Gitnotate enabled for this workspace');
    }),
    vscode.commands.registerCommand('gitnotate.disable', async () => {
      await disableWorkspace();
      vscode.window.showInformationMessage('Gitnotate disabled for this workspace');
    }),
    vscode.commands.registerCommand('gitnotate.addComment', () =>
      addCommentCommand(context, () => {
        // Invalidate caches so the next sync fetches fresh data
        if (threadSync) {
          threadSync.invalidateCache();
        }
        if (prService) {
          prService.clearEtagCache();
        }
        triggerSync();
      })
    ),
    vscode.commands.registerCommand('gitnotate.refreshComments', () => {
      debug('Manual refresh triggered');
      if (threadSync) {
        threadSync.invalidateCache();
      }
      if (prService) {
        prService.clearEtagCache();
      }
      triggerSync();
    }),
    vscode.commands.registerCommand(
      'gitnotate.goToComment',
      async (filePath: string, line: number, start?: number, end?: number) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const zeroLine = line - 1;
        const range = new vscode.Range(
          zeroLine, start ?? 0,
          zeroLine, end ?? Number.MAX_SAFE_INTEGER
        );

        try {
          // Validate filePath stays within workspace (prevent path traversal)
          const resolvedPath = path.resolve(workspaceRoot, filePath);
          const normalizedRoot = path.resolve(workspaceRoot);
          if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot) {
            debug('goToComment: path traversal blocked —', filePath);
            return;
          }

          // Check for an existing diff tab for this file
          const normalizedFile = filePath.replace(/\\/g, '/');
          const tabGroups = vscode.window.tabGroups?.all;
          debug('goToComment: looking for diff tab, filePath =', normalizedFile, 'tabGroups count =', tabGroups?.length ?? 'undefined');
          if (tabGroups) {
            for (const group of tabGroups) {
              for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputTextDiff) {
                  const diffInput = tab.input;
                  const modPath = diffInput.modified.fsPath.replace(/\\/g, '/');
                  debug('goToComment: found diff tab, modified.fsPath =', modPath);
                  if (modPath.endsWith(normalizedFile)) {
                    debug('goToComment: matched! Re-opening diff view');
                    // Re-open diff to activate the existing tab
                    await vscode.commands.executeCommand(
                      'vscode.diff',
                      diffInput.original,
                      diffInput.modified,
                      tab.label
                    );
                    // Set selection on the now-active editor
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                      editor.selection = new vscode.Selection(
                        range.start, range.end
                      );
                      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    }
                    commentCtrl?.revealThread(diffInput.modified, line);
                    return;
                  }
                }
              }
            }
          }
          debug('goToComment: no matching diff tab — opening regular file');

          // No diff tab found — fall back to regular file
          const fullPath = `${workspaceRoot}/${filePath}`;
          const uri = vscode.Uri.file(fullPath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { selection: range, preserveFocus: false });
          commentCtrl?.revealThread(uri, line);
        } catch (err) {
          debug('goToComment failed:', err);
        }
      }
    ),
    vscode.commands.registerCommand(
      'gitnotate.replyToThread',
      async (reply: { thread: vscode.CommentThread; text: string }) => {
        if (!commentCtrl || !prService) return;

        const parentId = commentCtrl.getParentCommentId(reply.thread);
        if (parentId === undefined) {
          debug('replyToThread: no parentCommentId on thread');
          return;
        }

        const token = await getGitHubToken();
        if (!token || !gitService) {
          debug('replyToThread: token or gitService not available — skipping');
          return;
        }
        const pr = await detectCurrentPR(gitService, token);
        if (!pr) return;

        const result = await prService.createReplyComment(pr, reply.text, parentId);
        if (result.ok) {
          commentCtrl.addReplyToThread(reply.thread, {
            body: reply.text,
            author: 'you',
          });
          // Invalidate caches so next sync fetches fresh data with the reply
          threadSync?.invalidateCache();
          prService?.clearEtagCache();
          triggerSync();
        } else {
          vscode.window.showErrorMessage(`Gitnotate: ${result.userMessage}`);
        }
      }
    ),
    vscode.commands.registerCommand(
      'gitnotate.resolveThread',
      (thread: vscode.CommentThread) => {
        if (!commentCtrl) return;
        commentCtrl.resolveThread(thread);
        debug('Thread resolved');
      }
    ),
    vscode.commands.registerCommand(
      'gitnotate.unresolveThread',
      (thread: vscode.CommentThread) => {
        if (!commentCtrl) return;
        commentCtrl.unresolveThread(thread);
        debug('Thread unresolved');
      }
    )
  );

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      debug('Editor changed:', editor ? editor.document.fileName : '(none)');
      if (editor) {
        debouncedSync(editor);
      } else {
        threadSync?.stopPolling();
      }
    }
  );

  context.subscriptions.push(editorChangeDisposable);
  context.subscriptions.push({ dispose: () => debouncedSync.dispose() });

  // Lifecycle: re-sync on save
  const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.languageId !== 'markdown') return;
    debug('Document saved:', doc.fileName);
    triggerSync();
  });
  context.subscriptions.push(saveDisposable);

  // Lifecycle: pause polling when window loses focus, resume when focused
  const windowStateDisposable = vscode.window.onDidChangeWindowState(
    (state: { focused: boolean }) => {
      if (!state.focused) {
        debug('Window lost focus — stopping polling');
        threadSync?.stopPolling();
      } else {
        debug('Window gained focus — re-syncing and resuming polling');
        triggerSync();
      }
    }
  );
  context.subscriptions.push(windowStateDisposable);

  // Lifecycle: clear threads on close
  const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.languageId !== 'markdown') return;
    // Skip comment input virtual documents
    if (doc.uri.scheme === 'comment' || doc.fileName.includes('commentinput-')) return;
    debug('Document closed:', doc.fileName);
    commentCtrl?.clearThreads(doc.uri);
    anchorTracker?.reset(doc.uri);
  });
  context.subscriptions.push(closeDisposable);

  // Lifecycle: re-sync on auth session change
  const authDisposable = vscode.authentication.onDidChangeSessions(async () => {
    debug('Auth session changed — invalidating cache and re-syncing');
    commentCtrl?.clearThreads();
    anchorTracker?.resetAll();
    const editor = vscode.window.activeTextEditor;
    if (editor && commentCtrl) {
      commentCtrl.clearHighlights(editor);
    }
    // Stop polling on the old sync before replacing it
    threadSync?.stopPolling();
    cachedToken = undefined;
    threadSync = undefined;
    prService = undefined;

    // Check if this is a sign-in or sign-out
    const newToken = await getGitHubToken();
    if (newToken) {
      // Only show "Loading" if we can actually sync right now
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'markdown') {
        treeProvider?.setState('loading');
      }
      // else: keep whatever state we had — sync will update when user opens a markdown file
    } else {
      treeProvider?.setState('noAuth');
      showAuthError();
    }
    triggerSync();
  });
  context.subscriptions.push(authDisposable);

  debug('Commands registered: enable, disable, addComment');
  updatePRStatusBar();

  // Sync the already-open editor (onDidChangeActiveTextEditor doesn't fire for it).
  // The vscode.git extension loads asynchronously — repos may not be available yet.
  // Retry with increasing delays until git is ready or we give up.
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelays = [1000, 2000, 3000, 4000, 5000];
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const tryInitialSync = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !gitService) {
      debug('Initial sync: editor or gitService not available — skipping');
      return;
    }

    if (!gitService.isAvailable()) {
      retryCount++;
      if (retryCount <= maxRetries) {
        debug('Initial sync: git not ready, retry', retryCount, 'of', maxRetries);
        retryTimer = setTimeout(tryInitialSync, retryDelays[retryCount - 1]);
      } else {
        debug('Initial sync: git not available after', maxRetries, 'retries — giving up');
      }
      return;
    }

    debug('Initial sync: triggering for', editor.document.fileName);
    debouncedSync(editor);
  };

  retryTimer = setTimeout(tryInitialSync, 500);
  context.subscriptions.push({ dispose: () => { if (retryTimer) clearTimeout(retryTimer); } });

  // Lifecycle: re-sync when git branch changes
  let gitWatcherRetries = 0;
  let gitWatcherTimer: ReturnType<typeof setTimeout> | undefined;
  const setupGitWatcher = () => {
    if (!gitService) {
      debug('Git watcher: gitService not available — skipping');
      return;
    }
    const disposable = gitService.onDidChangeState(() => {
      debug('Git state changed — re-syncing');
      threadSync?.stopPolling();
      threadSync?.invalidateCache();
      prService?.clearEtagCache();
      updatePRStatusBar();
      triggerSync();
    });
    if (disposable) {
      context.subscriptions.push(disposable);
      debug('Git state watcher registered');
    } else if (gitWatcherRetries < maxRetries) {
      gitWatcherRetries++;
      debug('Git state watcher: git not available, retry', gitWatcherRetries, 'of', maxRetries);
      gitWatcherTimer = setTimeout(setupGitWatcher, 3000);
    }
  };
  gitWatcherTimer = setTimeout(setupGitWatcher, 1000);
  context.subscriptions.push({ dispose: () => { if (gitWatcherTimer) clearTimeout(gitWatcherTimer); } });
}

/** @internal Test-only: reset gitService for guard branch coverage tests */
export function __testResetGitService(): void {
  gitService = undefined;
}

export function deactivate() {
  debug('Extension deactivating...');
  if (threadSync) {
    threadSync.stopPolling();
  }
  if (commentCtrl) {
    commentCtrl.dispose();
    commentCtrl = undefined;
  }
  if (treeProvider) {
    treeProvider.dispose();
    treeProvider = undefined;
  }
  prService = undefined;
  threadSync = undefined;
  cachedToken = undefined;
  gitService = undefined;
  gitServiceWarningShown = false;
  anchorTracker?.dispose();
  anchorTracker = undefined;
  statusBar?.dispose();
  statusBar = undefined;
  try {
    getLogger().dispose();
  } catch {
    // Logger was never created
  }
}
