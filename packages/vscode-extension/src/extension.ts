import * as vscode from 'vscode';
import { enableWorkspace, disableWorkspace } from './settings';
import { DecorationManager } from './decoration-manager';
import { addCommentCommand } from './comment-command';
import { addFileCommentCommand } from './file-comment-command';
import { detectCurrentPR } from './pr-detector';
import { GitService } from './git-service';
import { getGitHubToken } from './auth';
import { initLogger, debug } from './logger';

let decorationManager: DecorationManager | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

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
  } else {
    debug('No PR detected — status bar hidden');
    statusBarItem.hide();
  }
}

export function activate(context: vscode.ExtensionContext) {
  initLogger(context);
  debug('Extension activating...');

  decorationManager = new DecorationManager(context);

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
    ),
    vscode.commands.registerCommand('gitnotate.addFileComment', () =>
      addFileCommentCommand()
    )
  );

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (_editor) => {
      // TODO: fetch PR comments, parse ^gn metadata, apply decorations
    }
  );

  context.subscriptions.push(editorChangeDisposable);

  debug('Commands registered: enable, disable, addComment, addFileComment');
  updatePRStatusBar();
}

export function deactivate() {
  debug('Extension deactivating...');
  if (decorationManager) {
    decorationManager.dispose();
    decorationManager = undefined;
  }
  statusBarItem?.dispose();
}
