import * as vscode from 'vscode';

const GITHUB_PROVIDER_ID = 'github';
const SCOPES = ['repo'];

export async function getGitHubToken(): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession(
      GITHUB_PROVIDER_ID,
      SCOPES
    );
    return session?.accessToken;
  } catch {
    return undefined;
  }
}

export async function ensureAuthenticated(): Promise<string> {
  const session = await vscode.authentication.getSession(
    GITHUB_PROVIDER_ID,
    SCOPES,
    { createIfNone: true }
  );

  if (!session) {
    throw new Error(
      'GitHub authentication required. Please sign in to use Gitnotate.'
    );
  }

  return session.accessToken;
}

export function onDidChangeAuth(
  listener: (e: vscode.AuthenticationSessionsChangeEvent) => void
): vscode.Disposable {
  return vscode.authentication.onDidChangeSessions(listener);
}
