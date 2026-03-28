import * as vscode from 'vscode';
import { parseGnComment } from '@gitnotate/core';

export interface GnDecoration {
  range: vscode.Range;
  hoverMessage: string;
  commentBody: string;
}

export function createHighlightDecorationType(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 213, 79, 0.3)',
    borderBottom: '2px solid #f9a825',
    cursor: 'pointer',
  });
}

export function parseGnDecorations(
  commentBodies: string[],
  lineOffset: number = 0
): GnDecoration[] {
  const decorations: GnDecoration[] = [];

  for (const body of commentBodies) {
    const parsed = parseGnComment(body);
    if (!parsed) continue;

    const { metadata, userComment } = parsed;

    const range = new vscode.Range(
      lineOffset,
      metadata.start,
      lineOffset,
      metadata.end
    );

    const hoverMessage = userComment || `📌 "${metadata.exact}"`;

    decorations.push({
      range,
      hoverMessage,
      commentBody: body,
    });
  }

  return decorations;
}
