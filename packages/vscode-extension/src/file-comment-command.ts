import * as vscode from 'vscode';
import { createSelector, createSidecarFile, addAnnotation } from '@gitnotate/core';
import { readLocalSidecar, writeLocalSidecar } from './sidecar-provider';

function getRelativePath(filePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceFolder && filePath.startsWith(workspaceFolder)) {
    return filePath.slice(workspaceFolder.length + 1).replace(/\\/g, '/');
  }
  return filePath.replace(/\\/g, '/');
}

export async function addFileCommentCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showInformationMessage('Select text first');
    return;
  }

  const documentText = editor.document.getText();
  const startOffset = editor.document.offsetAt(editor.selection.start);
  const endOffset = editor.document.offsetAt(editor.selection.end);

  const commentText = await vscode.window.showInputBox({
    prompt: 'Enter your file comment',
    placeHolder: 'Type your comment...',
  });

  if (commentText === undefined) {
    return;
  }

  let sidecar = await readLocalSidecar(editor.document.fileName);
  if (!sidecar) {
    const relativePath = getRelativePath(editor.document.fileName);
    sidecar = createSidecarFile(relativePath);
  }

  const selector = createSelector(documentText, startOffset, endOffset);

  const updatedSidecar = addAnnotation(sidecar, {
    target: selector,
    author: { github: 'local-user' },
    body: commentText,
  });

  await writeLocalSidecar(editor.document.fileName, updatedSidecar);
  vscode.window.showInformationMessage('File comment added!');
}
