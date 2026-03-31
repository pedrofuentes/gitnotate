import * as vscode from 'vscode';
import { debug, warn } from './logger';

const GITHUB_PROVIDER_ID = 'github';
const SCOPES = ['repo'];

export async function getGitHubToken(): Promise<string | undefined> {
  try {
    debug('Auth: requesting GitHub session (silent)...');
    const session = await vscode.authentication.getSession(
      GITHUB_PROVIDER_ID,
      SCOPES
    );
    if (session) {
      debug('Auth: session found, account:', session.account?.label ?? 'unknown');
    } else {
      debug('Auth: no existing session');
    }
    return session?.accessToken;
  } catch (err) {
    warn('getGitHubToken failed:', err);
    return undefined;
  }
}

export async function ensureAuthenticated(): Promise<string> {
  debug('Auth: requesting GitHub session (with sign-in prompt)...');
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

  debug('Auth: authenticated as', session.account?.label ?? 'unknown');
  return session.accessToken;
}

export function onDidChangeAuth(
  listener: (e: vscode.AuthenticationSessionsChangeEvent) => void
): vscode.Disposable {
  return vscode.authentication.onDidChangeSessions(listener);
}
