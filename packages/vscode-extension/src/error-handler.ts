import * as vscode from 'vscode';

let lastErrorKey: string | null = null;
let lastErrorTime = 0;
const DEDUP_INTERVAL_MS = 30_000;

export async function showAuthError(): Promise<void> {
  if (isDuplicate('auth')) return;

  const action = await vscode.window.showErrorMessage(
    'Gitnotate: GitHub authentication required to fetch PR comments.',
    'Sign in to GitHub'
  );

  if (action === 'Sign in to GitHub') {
    await vscode.authentication.getSession('github', ['repo'], {
      createIfNone: true,
    });
  }
}

export async function showApiError(message: string): Promise<void> {
  if (isDuplicate('api:' + message)) return;

  const action = await vscode.window.showErrorMessage(
    `Gitnotate: ${message}`,
    'Retry'
  );

  if (action === 'Retry') {
    await vscode.commands.executeCommand('gitnotate.refreshComments');
  }
}

export async function showConfigError(message: string): Promise<void> {
  if (isDuplicate('config:' + message)) return;

  const action = await vscode.window.showErrorMessage(
    `Gitnotate: ${message}`,
    'Open Settings'
  );

  if (action === 'Open Settings') {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'gitnotate'
    );
  }
}

function isDuplicate(key: string): boolean {
  const now = Date.now();
  if (key === lastErrorKey && now - lastErrorTime < DEDUP_INTERVAL_MS) {
    return true;
  }
  lastErrorKey = key;
  lastErrorTime = now;
  return false;
}

export function __resetErrorState(): void {
  lastErrorKey = null;
  lastErrorTime = 0;
}
