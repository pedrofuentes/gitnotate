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

let commentCtrl: CommentController | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

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
      addCommentCommand(context)
    )
  );

  const debouncedSync = debounce(async (editor: vscode.TextEditor) => {
    if (editor.document.languageId !== 'markdown') return;

    const token = await getGitHubToken();
    if (!token) {
      debug('Comment sync: no auth token — skipping');
      return;
    }

    const gitService = new GitService();
    const pr = await detectCurrentPR(gitService, token);
    if (!pr) {
      debug('Comment sync: no PR found — skipping');
      return;
    }

    const prService = new PrService(token);
    if (!commentCtrl) return;
    const sync = new CommentThreadSync(prService, commentCtrl);
    const relativePath = getRelativePath(editor.document.fileName);
    debug('Comment sync: syncing', relativePath, `(PR #${pr.number})`);
    const highlightRanges = await sync.syncForDocument(editor.document.uri, relativePath, pr);
    if (highlightRanges.length > 0) {
      commentCtrl.applyHighlights(editor, highlightRanges);
    } else {
      commentCtrl.clearHighlights(editor);
    }
  }, 300);

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

  debug('Commands registered: enable, disable, addComment');
  updatePRStatusBar();
}

export function deactivate() {
  debug('Extension deactivating...');
  if (commentCtrl) {
    commentCtrl.dispose();
    commentCtrl = undefined;
  }
  statusBarItem?.dispose();
}
