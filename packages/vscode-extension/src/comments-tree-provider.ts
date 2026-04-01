import * as vscode from 'vscode';
import { parseGnComment } from '@gitnotate/core';
import type { ReviewComment } from './pr-service';
import { stripBlockquoteFallback } from './comment-thread-sync';

const MAX_LABEL_LENGTH = 60;

type SidebarState = 'loading' | 'noPr' | 'noAuth' | 'empty';

type TreeItemBase = FileItem | CommentItem | MessageItem;

export class FileItem extends vscode.TreeItem {
  readonly filePath: string;
  readonly commentCount: number;

  constructor(filePath: string, commentCount: number) {
    super(filePath, vscode.TreeItemCollapsibleState.Expanded);
    this.filePath = filePath;
    this.commentCount = commentCount;
    this.description = `${commentCount} comment${commentCount === 1 ? '' : 's'}`;
    this.iconPath = new vscode.ThemeIcon('file');
    this.contextValue = 'file';
  }
}

export class CommentItem extends vscode.TreeItem {
  readonly lineNumber: number;
  readonly commentId: number;

  constructor(
    label: string,
    description: string,
    lineNumber: number,
    commentId: number,
    command?: vscode.Command
  ) {
    super(truncate(label), vscode.TreeItemCollapsibleState.None);
    this.lineNumber = lineNumber;
    this.commentId = commentId;
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('comment');
    this.contextValue = 'comment';
    if (command) {
      this.command = command;
    }
  }
}

export class MessageItem extends vscode.TreeItem {
  constructor(label: string, command?: vscode.Command) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
    if (command) {
      this.command = command;
    }
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text;
  return text.slice(0, MAX_LABEL_LENGTH) + '...';
}

interface FileGroup {
  path: string;
  rootComments: ReviewComment[];
  replyCounts: Map<number, number>;
}

export class CommentsTreeProvider implements vscode.TreeDataProvider<TreeItemBase> {
  private fileGroups: FileGroup[] = [];
  private state: SidebarState = 'loading';
  private hasData = false;

  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  setComments(comments: ReviewComment[]): void {
    const rootComments = comments.filter((c) => c.inReplyToId === undefined);
    const replyCounts = new Map<number, number>();
    for (const c of comments) {
      if (c.inReplyToId !== undefined) {
        replyCounts.set(c.inReplyToId, (replyCounts.get(c.inReplyToId) ?? 0) + 1);
      }
    }

    const fileMap = new Map<string, ReviewComment[]>();
    for (const comment of rootComments) {
      const existing = fileMap.get(comment.path) ?? [];
      existing.push(comment);
      fileMap.set(comment.path, existing);
    }

    this.fileGroups = Array.from(fileMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, comments]) => ({
        path,
        rootComments: comments.sort((a, b) => {
          const lineA = this.getCommentLine(a);
          const lineB = this.getCommentLine(b);
          return lineA - lineB;
        }),
        replyCounts,
      }));

    this.hasData = rootComments.length > 0;
    this.state = this.hasData ? 'loading' : 'empty';

    void vscode.commands.executeCommand('setContext', 'gitnotate.hasComments', this.hasData);
    void vscode.commands.executeCommand('setContext', 'gitnotate.hasPR', true);

    this._onDidChangeTreeData.fire();
  }

  setState(state: SidebarState): void {
    this.state = state;
    this.hasData = false;
    this.fileGroups = [];

    if (state === 'noPr' || state === 'noAuth') {
      void vscode.commands.executeCommand('setContext', 'gitnotate.hasPR', false);
      void vscode.commands.executeCommand('setContext', 'gitnotate.hasComments', false);
    }

    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.setState('loading');
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItemBase): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItemBase): Promise<TreeItemBase[]> {
    if (!element) {
      return this.getRoots();
    }
    if (element instanceof FileItem) {
      return this.getFileChildren(element);
    }
    return [];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  private getRoots(): TreeItemBase[] {
    if (!this.hasData) {
      return [this.createMessageItem()];
    }
    return this.fileGroups.map(
      (group) => new FileItem(group.path, group.rootComments.length)
    );
  }

  private getFileChildren(fileItem: FileItem): TreeItemBase[] {
    const group = this.fileGroups.find((g) => g.path === fileItem.filePath);
    if (!group) return [];

    return group.rootComments.map((comment) => {
      const parsed = parseGnComment(comment.body);
      const author = comment.userLogin ?? 'unknown';
      const replyCount = group.replyCounts.get(comment.id) ?? 0;

      const { label, lineDesc, lineNumber, commandArgs } = parsed
        ? {
            label: stripBlockquoteFallback(parsed.userComment),
            lineDesc: `L${parsed.metadata.lineNumber}:${parsed.metadata.start}-${parsed.metadata.end}`,
            lineNumber: parsed.metadata.lineNumber,
            commandArgs: [comment.path, parsed.metadata.lineNumber, parsed.metadata.start, parsed.metadata.end],
          }
        : {
            label: comment.body,
            lineDesc: `L${comment.line ?? 1}`,
            lineNumber: comment.line ?? 1,
            commandArgs: [comment.path, comment.line ?? 1, undefined, undefined],
          };

      let description = `@${author} ${lineDesc}`;
      if (replyCount > 0) {
        description += ` · ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
      }

      const command: vscode.Command = {
        command: 'gitnotate.goToComment',
        title: 'Go to Comment',
        arguments: commandArgs,
      };

      return new CommentItem(label, description, lineNumber, comment.id, command);
    });
  }

  private getCommentLine(comment: ReviewComment): number {
    const parsed = parseGnComment(comment.body);
    return parsed ? parsed.metadata.lineNumber : (comment.line ?? 1);
  }

  private createMessageItem(): MessageItem {
    switch (this.state) {
      case 'loading':
        return new MessageItem('Loading comments...');
      case 'noPr':
        return new MessageItem('No open PR detected');
      case 'noAuth':
        return new MessageItem('Sign in to GitHub');
      case 'empty':
        return new MessageItem('No comments on this PR');
    }
  }
}
