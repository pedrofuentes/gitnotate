import * as vscode from 'vscode';
import { enableWorkspace, disableWorkspace } from './settings';
import { DecorationManager } from './decoration-manager';
import { addCommentCommand } from './comment-command';
import { addFileCommentCommand } from './file-comment-command';
import { detectCurrentPR } from './pr-detector';
import { GitService } from './git-service';
import { getGitHubToken } from './auth';

let decorationManager: DecorationManager | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

async function updatePRStatusBar(): Promise<void> {
  const gitService = new GitService();
  const token = await getGitHubToken();
  const pr = await detectCurrentPR(gitService, token);

  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
  }

  if (pr) {
    statusBarItem.text = `$(git-pull-request) Gitnotate: PR #${pr.number}`;
    statusBarItem.tooltip = `${pr.owner}/${pr.repo}#${pr.number}`;
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Gitnotate extension activated');

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

  updatePRStatusBar();
}

export function deactivate() {
  if (decorationManager) {
    decorationManager.dispose();
    decorationManager = undefined;
  }
  statusBarItem?.dispose();
}
