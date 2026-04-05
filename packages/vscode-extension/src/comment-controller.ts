import * as vscode from 'vscode';
import { getLogger, Logger } from './logger';

export interface ThreadComment {
  body: string;
  author: string;
}

const HIGHLIGHT_COLORS = [
  '#f9a825', // yellow
  '#1e88e5', // blue
  '#8e24aa', // purple
  '#ef6c00', // orange
  '#00897b', // teal
  '#c2185b', // pink
];

const COLOR_EMOJIS = [
  '🟡', // yellow
  '🔵', // blue
  '🟣', // purple
  '🟠', // orange
  '🟢', // teal
  '🔴', // pink
];

export class CommentController {
  private controller: vscode.CommentController;
  private threads: Map<string, vscode.CommentThread[]> = new Map();
  private decorationTypes: vscode.TextEditorDecorationType[];
  private log: Logger | undefined;
  private parentCommentIds: Map<vscode.CommentThread, number> = new Map();
  private threadCommentIds = new Map<vscode.CommentThread, number>();
  onThreadRevealed?: (commentId: number) => void;

  constructor() {
    try { this.log = getLogger(); } catch { /* logger not initialized */ }
    this.controller = vscode.comments.createCommentController(
      'gitnotate',
      'Gitnotate Sub-line Comments'
    );

    this.decorationTypes = HIGHLIGHT_COLORS.map((color) =>
      vscode.window.createTextEditorDecorationType({
        textDecoration: `underline wavy ${color}`,
        overviewRulerColor: color,
        overviewRulerLane: vscode.OverviewRulerLane?.Center,
      })
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

  getColorIndex(rangeIndex: number): number {
    return rangeIndex % HIGHLIGHT_COLORS.length;
  }

  getColorHex(rangeIndex: number): string {
    return HIGHLIGHT_COLORS[this.getColorIndex(rangeIndex)];
  }

  createThread(
    uri: vscode.Uri,
    range: vscode.Range,
    comments: ThreadComment[],
    colorIndex?: number,
    commentId?: number
  ): vscode.CommentThread {
    const colorEmoji = colorIndex !== undefined ? COLOR_EMOJIS[colorIndex % COLOR_EMOJIS.length] : undefined;

    const vscodeComments: vscode.Comment[] = comments.map((c) => ({
      body: c.body,
      mode: vscode.CommentMode.Preview,
      author: { name: c.author },
      label: colorEmoji,
    }));

    const thread = this.controller.createCommentThread(uri, range, vscodeComments);
    this.log?.info('CommentController', 'thread created at', `L${range.start.line + 1}`, uri.fsPath);

    if (commentId !== undefined) {
      this.parentCommentIds.set(thread, commentId);
      this.threadCommentIds.set(thread, commentId);
    }

    const key = uri.toString();
    const existing = this.threads.get(key) ?? [];
    existing.push(thread);
    this.threads.set(key, existing);

    return thread;
  }

  getParentCommentId(thread: vscode.CommentThread): number | undefined {
    return this.parentCommentIds.get(thread);
  }

  addReplyToThread(thread: vscode.CommentThread, comment: ThreadComment): void {
    const newComment: vscode.Comment = {
      body: comment.body,
      mode: vscode.CommentMode.Preview,
      author: { name: comment.author },
    };
    thread.comments = [...thread.comments, newComment];
  }

  resolveThread(thread: vscode.CommentThread): void {
    // TODO: Call GitHub GraphQL resolveReviewThread mutation
    thread.state = vscode.CommentThreadState.Resolved;
  }

  unresolveThread(thread: vscode.CommentThread): void {
    // TODO: Call GitHub GraphQL unresolveReviewThread mutation
    thread.state = vscode.CommentThreadState.Unresolved;
  }

  applyHighlights(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
    // Group ranges by color index
    const colorBuckets: Map<number, vscode.Range[]> = new Map();
    for (let i = 0; i < ranges.length; i++) {
      const colorIdx = this.getColorIndex(i);
      const bucket = colorBuckets.get(colorIdx) ?? [];
      bucket.push(ranges[i]);
      colorBuckets.set(colorIdx, bucket);
    }

    // Apply each color's ranges to its decoration type
    for (let i = 0; i < this.decorationTypes.length; i++) {
      const bucket = colorBuckets.get(i);
      if (bucket) {
        editor.setDecorations(this.decorationTypes[i], bucket);
      }
    }
  }

  clearHighlights(editor: vscode.TextEditor): void {
    for (const decorationType of this.decorationTypes) {
      editor.setDecorations(decorationType, []);
    }
  }

  clearThreads(uri?: vscode.Uri): void {
    if (uri) {
      const key = uri.toString();
      const threads = this.threads.get(key);
      if (threads) {
        for (const thread of threads) {
          this.threadCommentIds.delete(thread);
          thread.dispose();
        }
        this.threads.delete(key);
      }
    } else {
      for (const threads of this.threads.values()) {
        for (const thread of threads) {
          this.threadCommentIds.delete(thread);
          thread.dispose();
        }
      }
      this.threads.clear();
    }
  }

  revealThread(uri: vscode.Uri, lineNumber: number): boolean {
    const key = uri.toString();
    const threads = this.threads.get(key);
    if (!threads) return false;

    const zeroLine = lineNumber - 1;
    const thread = threads.find((t) => t.range?.start.line === zeroLine);
    if (!thread) return false;

    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

    const commentId = this.threadCommentIds.get(thread);
    if (commentId !== undefined) {
      this.onThreadRevealed?.(commentId);
    }

    return true;
  }

  dispose(): void {
    this.log?.info('CommentController', 'disposing');
    this.clearThreads();
    this.threadCommentIds.clear();
    for (const decorationType of this.decorationTypes) {
      decorationType.dispose();
    }
    this.controller.dispose();
  }
}
