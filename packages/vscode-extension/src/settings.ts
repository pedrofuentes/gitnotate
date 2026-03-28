import * as vscode from 'vscode';

const SECTION = 'gitnotate';
const ENABLED_REPOS_KEY = 'enabledRepos';

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

export function isWorkspaceEnabled(): boolean {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return false;

  const enabledRepos = getConfig().get<string[]>(ENABLED_REPOS_KEY, []);
  return enabledRepos.includes(workspacePath);
}

export async function enableWorkspace(): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

  const config = getConfig();
  const enabledRepos = config.get<string[]>(ENABLED_REPOS_KEY, []);

  if (!enabledRepos.includes(workspacePath)) {
    await config.update(
      ENABLED_REPOS_KEY,
      [...enabledRepos, workspacePath],
      vscode.ConfigurationTarget.Global
    );
  }
}

export async function disableWorkspace(): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

  const config = getConfig();
  const enabledRepos = config.get<string[]>(ENABLED_REPOS_KEY, []);

  await config.update(
    ENABLED_REPOS_KEY,
    enabledRepos.filter((r) => r !== workspacePath),
    vscode.ConfigurationTarget.Global
  );
}
