import * as vscode from 'vscode';
import { createSelector, createSidecarFile, addAnnotation } from '@gitnotate/core';
import { readLocalSidecar, writeLocalSidecar } from './sidecar-provider';
import { getRelativePath } from './utils';
import { debug } from './logger';

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
    debug('File comment: user cancelled input');
    return;
  }

  const relativePath = getRelativePath(editor.document.fileName);
  debug('File comment: file =', relativePath, 'offsets =', startOffset, '-', endOffset);

  let sidecar = await readLocalSidecar(editor.document.fileName);
  if (!sidecar) {
    debug('File comment: creating new sidecar for', relativePath);
    sidecar = createSidecarFile(relativePath);
  } else {
    debug('File comment: appending to existing sidecar,', sidecar.annotations.length, 'existing annotations');
  }

  const selector = createSelector(documentText, startOffset, endOffset);
  debug('File comment: selector =', JSON.stringify(selector));

  const updatedSidecar = addAnnotation(sidecar, {
    target: selector,
    author: { github: 'local-user' },
    body: commentText,
  });

  await writeLocalSidecar(editor.document.fileName, updatedSidecar);
  debug('File comment: written to', editor.document.fileName);
  vscode.window.showInformationMessage('File comment added!');
}
