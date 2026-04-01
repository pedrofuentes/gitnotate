import * as vscode from 'vscode';
import { enableWorkspace, disableWorkspace } from './settings';
import { addCommentCommand } from './comment-command';
import { detectCurrentPR } from './pr-detector';
import { GitService } from './git-service';
import { getGitHubToken, ensureAuthenticated } from './auth';
import { initLogger, debug } from './logger';
import { CommentController } from './comment-controller';
import { CommentThreadSync } from './comment-thread-sync';
import { PrService } from './pr-service';
import { getRelativePath, debounce } from './utils';
import { CommentsTreeProvider } from './comments-tree-provider';

let commentCtrl: CommentController | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let prService: PrService | undefined;
let threadSync: CommentThreadSync | undefined;
let cachedToken: string | undefined;
let treeProvider: CommentsTreeProvider | undefined;

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
  const gitService = new GitService();
  const token = await getGitHubToken();
  debug('Auth token:', token ? 'present' : 'absent');
  const pr = await detectCurrentPR(gitService, token);

  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
  }

  if (pr) {
    debug('PR detected:', `${pr.owner}/${pr.repo}#${pr.number}`);
    statusBarItem.text = `$(git-pull-request) Gitnotate: PR #${pr.number}`;
    statusBarItem.tooltip = `${pr.owner}/${pr.repo}#${pr.number}`;
    statusBarItem.show();

    if (!token) {
      promptSignIn();
    }
  } else {
    debug('No PR detected — status bar hidden');
    statusBarItem.hide();
  }
}

export function activate(context: vscode.ExtensionContext) {
  initLogger(context);
  debug('Extension activating...');

  commentCtrl = new CommentController();
  context.subscriptions.push({ dispose: () => commentCtrl?.dispose() });

  treeProvider = new CommentsTreeProvider();
  const treeView = vscode.window.createTreeView('gitnotateComments', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  context.subscriptions.push({ dispose: () => treeProvider?.dispose() });

  const debouncedSync = debounce(async (editor: vscode.TextEditor) => {
    debug('Comment sync: editor changed →', editor.document.fileName, `(${editor.document.languageId})`);
    if (editor.document.languageId !== 'markdown') {
      debug('Comment sync: not markdown — skipping');
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
      threadSync = new CommentThreadSync(prService, commentCtrl);
      debug('Comment sync: recreated PrService + CommentThreadSync (token changed)');
    }

    const gitService = new GitService();
    const pr = await detectCurrentPR(gitService, token);
    if (!pr) {
      debug('Comment sync: no PR found — skipping');
      treeProvider?.setState('noPr');
      return;
    }

    if (!commentCtrl) return;
    const relativePath = getRelativePath(editor.document.fileName);
    debug('Comment sync: syncing', relativePath, `(PR #${pr.number})`);
    const highlightRanges = await threadSync.syncForDocumentCacheFirst(editor.document.uri, relativePath, pr);
    if (highlightRanges.length > 0) {
      commentCtrl.applyHighlights(editor, highlightRanges);
    } else {
      commentCtrl.clearHighlights(editor);
    }

    // Update sidebar tree with all comments from this PR
    const cachedComments = threadSync.getCachedComments(pr);
    if (cachedComments) {
      treeProvider?.setComments(cachedComments);
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
      addCommentCommand(context, triggerSync)
    ),
    vscode.commands.registerCommand('gitnotate.refreshComments', () => {
      debug('Manual refresh triggered');
      triggerSync();
    }),
    vscode.commands.registerCommand(
      'gitnotate.goToComment',
      async (filePath: string, line: number, start?: number, end?: number) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const fullPath = `${workspaceRoot}/${filePath}`;
        const uri = vscode.Uri.file(fullPath);
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          const zeroLine = line - 1;
          const range = new vscode.Range(
            zeroLine, start ?? 0,
            zeroLine, end ?? Number.MAX_SAFE_INTEGER
          );
          await vscode.window.showTextDocument(doc, { selection: range, preserveFocus: false });
        } catch (err) {
          debug('goToComment failed:', err);
        }
      }
    )
  );

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      debug('Editor changed:', editor ? editor.document.fileName : '(none)');
      if (editor) {
        debouncedSync(editor);
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

  // Lifecycle: clear threads on close
  const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.languageId !== 'markdown') return;
    debug('Document closed:', doc.fileName);
    commentCtrl?.clearThreads(doc.uri);
  });
  context.subscriptions.push(closeDisposable);

  // Lifecycle: re-sync on auth session change
  const authDisposable = vscode.authentication.onDidChangeSessions(() => {
    debug('Auth session changed — invalidating cache and re-syncing');
    commentCtrl?.clearThreads();
    const editor = vscode.window.activeTextEditor;
    if (editor && commentCtrl) {
      commentCtrl.clearHighlights(editor);
    }
    treeProvider?.setState('noAuth');
    cachedToken = undefined;
    threadSync = undefined;
    prService = undefined;
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
    if (!editor) return;

    const gitService = new GitService();
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
}

export function deactivate() {
  debug('Extension deactivating...');
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
  statusBarItem?.dispose();
}
