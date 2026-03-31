import * as vscode from 'vscode';

export interface ThreadComment {
  body: string;
  author: string;
}

export class CommentController {
  private controller: vscode.CommentController;
  private threads: Map<string, vscode.CommentThread[]> = new Map();

  constructor() {
    this.controller = vscode.comments.createCommentController(
      'gitnotate',
      'Gitnotate Sub-line Comments'
    );

    this.controller.commentingRangeProvider = {
      provideCommentingRanges(document: vscode.TextDocument): vscode.Range[] {
        if (document.languageId !== 'markdown') return [];

        const ranges: vscode.Range[] = [];
        for (let i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i);
          if (!line.isEmptyOrWhitespace) {
            ranges.push(line.range);
          }
        }
        return ranges;
      },
    };
  }

  createThread(
    uri: vscode.Uri,
    range: vscode.Range,
    comments: ThreadComment[]
  ): vscode.CommentThread {
    const vscodeComments: vscode.Comment[] = comments.map((c) => ({
      body: c.body,
      mode: vscode.CommentMode.Preview,
      author: { name: c.author },
    }));

    const thread = this.controller.createCommentThread(uri, range, vscodeComments);

    const key = uri.fsPath;
    const existing = this.threads.get(key) ?? [];
    existing.push(thread);
    this.threads.set(key, existing);

    return thread;
  }

  clearThreads(uri?: vscode.Uri): void {
    if (uri) {
      const key = uri.fsPath;
      const threads = this.threads.get(key);
      if (threads) {
        for (const thread of threads) {
          thread.dispose();
        }
        this.threads.delete(key);
      }
    } else {
      for (const threads of this.threads.values()) {
        for (const thread of threads) {
          thread.dispose();
        }
      }
      this.threads.clear();
    }
  }

  dispose(): void {
    this.clearThreads();
    this.controller.dispose();
  }
}
