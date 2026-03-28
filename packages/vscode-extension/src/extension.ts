import * as vscode from 'vscode';
import { enableWorkspace, disableWorkspace } from './settings';
import { addCommentCommand } from './comment-command';
import { detectCurrentPR } from './pr-detector';

let statusBarItem: vscode.StatusBarItem | undefined;

async function updatePRStatusBar(): Promise<void> {
  const pr = await detectCurrentPR();

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

function checkGitHubToken(): void {
  const config = vscode.workspace.getConfiguration('gitnotate');
  const token = config.get<string>('githubToken');
  if (!token) {
    vscode.window.showWarningMessage(
      'Gitnotate: No GitHub token configured. Set gitnotate.githubToken in settings to enable PR commenting.'
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Gitnotate extension activated');

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

  // Check for token on activation
  checkGitHubToken();

  // Show PR status bar
  updatePRStatusBar();
}

export function deactivate() {
  statusBarItem?.dispose();
}
