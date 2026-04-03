import * as vscode from 'vscode';
import { buildGnComment } from '@gitnotate/core';
import { PrService } from './pr-service';
import { detectCurrentPR } from './pr-detector';
import { getRelativePath } from './utils';
import { GitService } from './git-service';
import { getGitHubToken } from './auth';
import { debug } from './logger';
import type { GnMetadata } from '@gitnotate/core';

export async function addCommentCommand(
  _context: vscode.ExtensionContext,
  onCommentPosted?: () => void
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showInformationMessage('Select text first');
    return;
  }

  // Authenticate via OAuth
  const token = await getGitHubToken();
  if (!token) {
    vscode.window.showErrorMessage(
      'GitHub authentication required. Please sign in to GitHub.'
    );
    return;
  }

  // Detect current PR
  const gitService = new GitService();
  const pr = await detectCurrentPR(gitService, token);
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
  const client = new PrService(token);
  const filePath = getRelativePath(editor.document.fileName);
  const line = editor.selection.start.line + 1;

  debug('Add Comment:', { file: filePath, line, side: 'RIGHT', pr: `${pr.owner}/${pr.repo}#${pr.number}`, headSha: pr.headSha });
  debug('Comment body:', commentBody);

  // Try review endpoint first (handles pending review case)
  let result: { ok: boolean; userMessage?: string } = await client.createReviewWithComment(
    pr,
    filePath,
    line,
    'RIGHT',
    commentBody
  );

  // If review endpoint fails, fall back to single-comment endpoint
  if (!result.ok) {
    debug('Review endpoint failed, falling back to single-comment endpoint');
    result = await client.createReviewComment(pr, filePath, line, 'RIGHT', commentBody);
  }

  if (result.ok) {
    vscode.window.showInformationMessage('Comment posted successfully!');
    onCommentPosted?.();
  } else {
    vscode.window.showErrorMessage(`Gitnotate: ${result.userMessage ?? 'Failed to post comment.'}`);
  }
}
