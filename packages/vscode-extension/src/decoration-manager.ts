import * as vscode from 'vscode';
import type { GnDecoration } from './comment-decoration';
import { createHighlightDecorationType } from './comment-decoration';

export class DecorationManager {
  private decorationType: vscode.TextEditorDecorationType | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  applyDecorations(
    editor: vscode.TextEditor,
    decorations: GnDecoration[]
  ): void {
    if (!editor) return;

    if (!this.decorationType) {
      this.decorationType = createHighlightDecorationType();
    }

    const ranges = decorations.map((dec) => ({
      range: dec.range,
      hoverMessage: new vscode.MarkdownString(dec.hoverMessage),
    }));

    editor.setDecorations(this.decorationType, ranges);
  }

  clearDecorations(editor: vscode.TextEditor): void {
    if (!editor || !this.decorationType) return;
    editor.setDecorations(this.decorationType, []);
  }

  dispose(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
      this.decorationType = undefined;
    }
  }
}
