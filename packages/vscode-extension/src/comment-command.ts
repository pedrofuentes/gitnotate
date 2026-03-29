import * as vscode from 'vscode';
import { buildGnComment } from '@gitnotate/core';
import { GitHubApiClient } from './github-api';
import { detectCurrentPR } from './pr-detector';
import { getRelativePath } from './utils';
import type { GnMetadata } from '@gitnotate/core';

export async function addCommentCommand(
  _context: vscode.ExtensionContext
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showInformationMessage('Select text first');
    return;
  }

  // Check for GitHub token
  const config = vscode.workspace.getConfiguration('gitnotate');
  const token = config.get<string>('githubToken');
  if (!token) {
    vscode.window.showErrorMessage(
      'GitHub token not configured. Set gitnotate.githubToken in settings.'
    );
    return;
  }

  // Detect current PR
  const pr = await detectCurrentPR();
  if (!pr) {
    vscode.window.showWarningMessage(
      'No pull request found for the current branch.'
    );
    return;
  }

  // Prompt for comment text
  const userComment = await vscode.window.showInputBox({
    prompt: 'Enter your comment for the selected text',
    placeHolder: 'Type your comment...',
  });

  if (userComment === undefined) {
    return; // User cancelled
  }

  // Build ^gn comment
  const selectedText = editor.document.getText(editor.selection);
  const metadata: GnMetadata = {
    exact: selectedText,
    lineNumber: editor.selection.start.line + 1,
    side: 'R',
    start: editor.selection.start.character,
    end: editor.selection.end.character,
  };

  const commentBody = buildGnComment(metadata, userComment);

  // Submit via GitHub API
  const client = new GitHubApiClient(token);
  const filePath = getRelativePath(editor.document.fileName);
  const line = editor.selection.start.line + 1; // VSCode is 0-indexed, GitHub API is 1-indexed

  const success = await client.createReviewComment(
    pr,
    filePath,
    line,
    'RIGHT',
    commentBody
  );

  if (success) {
    vscode.window.showInformationMessage('Comment posted successfully!');
  } else {
    vscode.window.showErrorMessage('Failed to post comment. Check your token and permissions.');
  }
}
