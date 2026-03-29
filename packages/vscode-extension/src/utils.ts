import * as vscode from 'vscode';

export function getRelativePath(filePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceFolder && filePath.startsWith(workspaceFolder)) {
    return filePath.slice(workspaceFolder.length + 1).replace(/\\/g, '/');
  }
  return filePath.replace(/\\/g, '/');
}
