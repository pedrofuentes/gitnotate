import * as vscode from 'vscode';

interface TrackedAnchor {
  line: number;
  thread: vscode.CommentThread;
}

/**
 * Tracks active comment thread positions and shifts them when
 * lines are inserted or deleted above them in the document.
 */
export class AnchorTracker {
  private anchors: Map<string, TrackedAnchor[]> = new Map();
  private disposable: vscode.Disposable | null = null;

  activate(): void {
    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      this.handleDocumentChange(event);
    });
  }

  registerThread(uri: vscode.Uri, line: number, thread: vscode.CommentThread): void {
    const key = uri.toString();
    const anchors = this.anchors.get(key) ?? [];
    anchors.push({ line, thread });
    this.anchors.set(key, anchors);
  }

  unregisterThread(uri: vscode.Uri, thread: vscode.CommentThread): void {
    const key = uri.toString();
    const anchors = this.anchors.get(key);
    if (!anchors) return;
    const filtered = anchors.filter((a) => a.thread !== thread);
    if (filtered.length === 0) {
      this.anchors.delete(key);
    } else {
      this.anchors.set(key, filtered);
    }
  }

  reset(uri: vscode.Uri): void {
    this.anchors.delete(uri.toString());
  }

  resetAll(): void {
    this.anchors.clear();
  }

  getAnchorCount(uri: vscode.Uri): number {
    return this.anchors.get(uri.toString())?.length ?? 0;
  }

  dispose(): void {
    this.disposable?.dispose();
    this.anchors.clear();
  }

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const key = event.document.uri.toString();
    const anchors = this.anchors.get(key);
    if (!anchors || anchors.length === 0) return;

    // Process changes bottom-to-top to avoid invalidating line numbers
    const sortedChanges = [...event.contentChanges].sort(
      (a, b) => b.range.start.line - a.range.start.line
    );

    for (const change of sortedChanges) {
      const changeStartLine = change.range.start.line;
      const changeEndLine = change.range.end.line;
      const oldLineCount = changeEndLine - changeStartLine;
      const newLineCount = (change.text.match(/\n/g) || []).length;
      const lineDelta = newLineCount - oldLineCount;

      if (lineDelta === 0) continue;

      for (const anchor of anchors) {
        if (anchor.line > changeEndLine) {
          anchor.line += lineDelta;
          const oldRange = anchor.thread.range;
          if (oldRange) {
            const newStartLine = oldRange.start.line + lineDelta;
            const newEndLine = oldRange.end.line + lineDelta;
            if (newStartLine >= 0) {
              anchor.thread.range = new vscode.Range(
                newStartLine,
                oldRange.start.character,
                newEndLine,
                oldRange.end.character
              );
            }
          }
        }
      }
    }
  }
}
