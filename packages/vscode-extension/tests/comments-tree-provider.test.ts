import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __getContextKeys,
  TreeItemCollapsibleState,
  TreeItem,
  ThemeIcon,
  commands,
  window,
} from 'vscode';
import type { ReviewComment } from '../src/pr-service';

// The module under test — does not exist yet (RED phase)
import {
  CommentsTreeProvider,
  FileItem,
  CommentItem,
  MessageItem,
} from '../src/comments-tree-provider';

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 1,
    body: 'Test comment body',
    path: 'docs/proposal.md',
    line: 10,
    side: 'RIGHT',
    inReplyToId: undefined,
    userLogin: 'pedro',
    createdAt: '2026-03-30T10:00:00Z',
    updatedAt: '2026-03-30T10:00:00Z',
    ...overrides,
  };
}

function makeGnComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return makeComment({
    body: '^gn:10:R:5:20\n> 📌 **"revenue growth"** (chars 5–20)\n\nCan we add the percentage?',
    ...overrides,
  });
}

describe('CommentsTreeProvider', () => {
  let provider: CommentsTreeProvider;

  beforeEach(() => {
    __reset();
    provider = new CommentsTreeProvider();
  });

  describe('initial state', () => {
    it('should return a loading message item when no data is set', async () => {
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(MessageItem);
    });
  });

  describe('setComments — tree structure', () => {
    it('should group comments by file path as root items', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'docs/proposal.md', id: 1 }),
        makeComment({ path: 'docs/proposal.md', id: 2 }),
        makeComment({ path: 'README.md', id: 3 }),
      ];
      provider.setComments(comments);

      const roots = await provider.getChildren();
      expect(roots).toHaveLength(2);
      expect(roots.every((r) => r instanceof FileItem)).toBe(true);
    });

    it('should sort file items alphabetically by path', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'z-file.md', id: 1 }),
        makeComment({ path: 'a-file.md', id: 2 }),
        makeComment({ path: 'docs/mid.md', id: 3 }),
      ];
      provider.setComments(comments);

      const roots = await provider.getChildren();
      const labels = roots.map((r) => (r as FileItem).label);
      expect(labels).toEqual(['a-file.md', 'docs/mid.md', 'z-file.md']);
    });

    it('should return comment items as children of a file item', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'docs/proposal.md', id: 1, line: 10 }),
        makeComment({ path: 'docs/proposal.md', id: 2, line: 20 }),
      ];
      provider.setComments(comments);

      const roots = await provider.getChildren();
      const fileItem = roots[0] as FileItem;
      const children = await provider.getChildren(fileItem);
      expect(children).toHaveLength(2);
      expect(children.every((c) => c instanceof CommentItem)).toBe(true);
    });

    it('should sort comment items by line number', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'docs/proposal.md', id: 1, line: 30 }),
        makeComment({ path: 'docs/proposal.md', id: 2, line: 10 }),
        makeComment({ path: 'docs/proposal.md', id: 3, line: 20 }),
      ];
      provider.setComments(comments);

      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const lines = (children as CommentItem[]).map((c) => c.lineNumber);
      expect(lines).toEqual([10, 20, 30]);
    });

    it('should include only root comments (not replies) as tree items', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'docs/proposal.md', id: 1, line: 10 }),
        makeComment({ path: 'docs/proposal.md', id: 2, line: 10, inReplyToId: 1 }),
        makeComment({ path: 'docs/proposal.md', id: 3, line: 10, inReplyToId: 1 }),
      ];
      provider.setComments(comments);

      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      expect(children).toHaveLength(1);
    });

    it('should show reply count in comment description when replies exist', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'docs/proposal.md', id: 1, line: 10, body: 'Root comment' }),
        makeComment({ path: 'docs/proposal.md', id: 2, line: 10, inReplyToId: 1 }),
        makeComment({ path: 'docs/proposal.md', id: 3, line: 10, inReplyToId: 1 }),
      ];
      provider.setComments(comments);

      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const commentItem = children[0] as CommentItem;
      expect(commentItem.description).toContain('2 replies');
    });
  });

  describe('file items', () => {
    it('should have the file path as label', async () => {
      provider.setComments([makeComment({ path: 'docs/proposal.md' })]);
      const roots = await provider.getChildren();
      expect((roots[0] as FileItem).label).toBe('docs/proposal.md');
    });

    it('should show root comment count in description', async () => {
      const comments: ReviewComment[] = [
        makeComment({ path: 'docs/proposal.md', id: 1 }),
        makeComment({ path: 'docs/proposal.md', id: 2 }),
        makeComment({ path: 'docs/proposal.md', id: 3, inReplyToId: 1 }),
      ];
      provider.setComments(comments);
      const roots = await provider.getChildren();
      expect((roots[0] as FileItem).description).toBe('2 comments');
    });

    it('should use singular "comment" when only one', async () => {
      provider.setComments([makeComment({ path: 'docs/proposal.md' })]);
      const roots = await provider.getChildren();
      expect((roots[0] as FileItem).description).toBe('1 comment');
    });

    it('should be collapsible (expanded)', async () => {
      provider.setComments([makeComment({ path: 'docs/proposal.md' })]);
      const roots = await provider.getChildren();
      expect((roots[0] as FileItem).collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
    });

    it('should have a file icon', async () => {
      provider.setComments([makeComment({ path: 'docs/proposal.md' })]);
      const roots = await provider.getChildren();
      expect((roots[0] as FileItem).iconPath).toBeInstanceOf(ThemeIcon);
      expect(((roots[0] as FileItem).iconPath as ThemeIcon).id).toBe('file');
    });
  });

  describe('^gn comment items', () => {
    it('should parse ^gn metadata and show user comment as label', async () => {
      provider.setComments([makeGnComment({ id: 1 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.label).toBe('Can we add the percentage?');
    });

    it('should show author and sub-line range in description', async () => {
      provider.setComments([makeGnComment({ id: 1, userLogin: 'pedro' })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toContain('@pedro');
      expect(item.description).toContain('L10:5-20');
    });

    it('should use comment icon', async () => {
      provider.setComments([makeGnComment({ id: 1 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.iconPath).toBeInstanceOf(ThemeIcon);
      expect(((item).iconPath as ThemeIcon).id).toBe('comment');
    });

    it('should truncate long comment bodies', async () => {
      const longBody = '^gn:10:R:5:20\n> 📌 **"text"** (chars 5–20)\n\n' +
        'This is a very long comment that should be truncated to about sixty characters for readability in the sidebar';
      provider.setComments([makeComment({ id: 1, body: longBody })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      const labelStr = typeof item.label === 'string' ? item.label : (item.label as { label: string }).label;
      expect(labelStr.length).toBeLessThanOrEqual(63); // 60 + "..."
    });

    it('should store line number for sorting', async () => {
      provider.setComments([makeGnComment({ id: 1 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      expect((children[0] as CommentItem).lineNumber).toBe(10);
    });
  });

  describe('regular line comment items', () => {
    it('should use comment body as label', async () => {
      provider.setComments([makeComment({ id: 1, body: 'This needs work', line: 15 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.label).toBe('This needs work');
    });

    it('should show author and line number in description', async () => {
      provider.setComments([makeComment({ id: 1, body: 'Fix this', line: 15, userLogin: 'maria' })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toContain('@maria');
      expect(item.description).toContain('L15');
    });

    it('should not include sub-line range for regular comments', async () => {
      provider.setComments([makeComment({ id: 1, body: 'Fix this', line: 15 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).not.toMatch(/L15:\d+-\d+/);
    });

    it('should show "unknown" when userLogin is undefined', async () => {
      provider.setComments([makeComment({ id: 1, userLogin: undefined })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      expect((children[0] as CommentItem).description).toContain('@unknown');
    });
  });

  describe('state management', () => {
    it('should show "No open PR detected" message for noPr state', async () => {
      provider.setState('noPr');
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(MessageItem);
      expect((children[0] as MessageItem).label).toContain('No open PR');
    });

    it('should show "Sign in to GitHub" message for noAuth state', async () => {
      provider.setState('noAuth');
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      const item = children[0] as MessageItem;
      expect(item.label).toContain('Sign in');
    });

    it('should show "No comments" message for empty state', async () => {
      provider.setState('empty');
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect((children[0] as MessageItem).label).toContain('No comments');
    });

    it('should show "Loading" message for loading state', async () => {
      provider.setState('loading');
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect((children[0] as MessageItem).label).toContain('Loading');
    });

    it('should show empty state when setComments receives empty root comments', async () => {
      provider.setComments([]);
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(MessageItem);
    });

    it('should show empty state when all comments are replies', async () => {
      provider.setComments([
        makeComment({ id: 2, inReplyToId: 1 }),
        makeComment({ id: 3, inReplyToId: 1 }),
      ]);
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(MessageItem);
    });

    it('should clear tree data', async () => {
      provider.setComments([makeComment({ id: 1 })]);
      let roots = await provider.getChildren();
      expect(roots).toHaveLength(1);

      provider.clear();
      roots = await provider.getChildren();
      expect(roots).toHaveLength(1);
      expect(roots[0]).toBeInstanceOf(MessageItem);
    });
  });

  describe('refresh', () => {
    it('should fire onDidChangeTreeData event on refresh', () => {
      const listener = vi.fn();
      provider.onDidChangeTreeData(listener);
      provider.refresh();
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should fire event when setComments is called', () => {
      const listener = vi.fn();
      provider.onDidChangeTreeData(listener);
      provider.setComments([makeComment({ id: 1 })]);
      expect(listener).toHaveBeenCalledOnce();
    });

    it('should fire event when setState is called', () => {
      const listener = vi.fn();
      provider.onDidChangeTreeData(listener);
      provider.setState('noPr');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('context keys', () => {
    it('should set gitnotate.hasComments to true when comments exist', () => {
      provider.setComments([makeComment({ id: 1 })]);
      const keys = __getContextKeys();
      expect(keys.get('gitnotate.hasComments')).toBe(true);
    });

    it('should set gitnotate.hasComments to false when no root comments', () => {
      provider.setComments([]);
      const keys = __getContextKeys();
      expect(keys.get('gitnotate.hasComments')).toBe(false);
    });

    it('should set gitnotate.hasPR to true when comments are set', () => {
      provider.setComments([makeComment({ id: 1 })]);
      const keys = __getContextKeys();
      expect(keys.get('gitnotate.hasPR')).toBe(true);
    });

    it('should set gitnotate.hasPR to false on noPr state', () => {
      provider.setState('noPr');
      const keys = __getContextKeys();
      expect(keys.get('gitnotate.hasPR')).toBe(false);
    });

    it('should set gitnotate.hasPR to false on noAuth state', () => {
      provider.setState('noAuth');
      const keys = __getContextKeys();
      expect(keys.get('gitnotate.hasPR')).toBe(false);
    });

    it('should call executeCommand with setContext', () => {
      provider.setComments([makeComment({ id: 1 })]);
      expect(commands.executeCommand).toHaveBeenCalledWith('setContext', 'gitnotate.hasComments', true);
      expect(commands.executeCommand).toHaveBeenCalledWith('setContext', 'gitnotate.hasPR', true);
    });
  });

  describe('getTreeItem', () => {
    it('should return the element itself', async () => {
      provider.setComments([makeComment({ id: 1 })]);
      const roots = await provider.getChildren();
      expect(provider.getTreeItem(roots[0])).toBe(roots[0]);
    });
  });

  describe('click-to-navigate commands', () => {
    it('should set goToComment command on ^gn comment items', async () => {
      provider.setComments([makeGnComment({ id: 1, path: 'docs/proposal.md' })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.command).toBeDefined();
      expect(item.command!.command).toBe('gitnotate.goToComment');
    });

    it('should pass file path, line, start, end as arguments for ^gn comments', async () => {
      provider.setComments([makeGnComment({ id: 1, path: 'docs/proposal.md' })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      const args = item.command!.arguments!;
      expect(args[0]).toBe('docs/proposal.md');
      expect(args[1]).toBe(10); // line number from ^gn:10:R:5:20
      expect(args[2]).toBe(5);  // start
      expect(args[3]).toBe(20); // end
    });

    it('should set goToComment command on regular comment items', async () => {
      provider.setComments([makeComment({ id: 1, path: 'README.md', line: 15 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.command).toBeDefined();
      expect(item.command!.command).toBe('gitnotate.goToComment');
    });

    it('should pass file path and line without start/end for regular comments', async () => {
      provider.setComments([makeComment({ id: 1, path: 'README.md', line: 15 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      const args = item.command!.arguments!;
      expect(args[0]).toBe('README.md');
      expect(args[1]).toBe(15);
      expect(args[2]).toBeUndefined();
      expect(args[3]).toBeUndefined();
    });
  });

  describe('side indicator', () => {
    it('should show [Old] for LEFT side regular comment', async () => {
      provider.setComments([makeComment({ id: 1, side: 'LEFT', line: 10 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toContain('[Old]');
    });

    it('should show [New] for RIGHT side regular comment', async () => {
      provider.setComments([makeComment({ id: 1, side: 'RIGHT', line: 10 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toContain('[New]');
    });

    it('should show [Old] for ^gn comment with L side', async () => {
      const comment = makeGnComment({
        id: 1,
        body: '^gn:10:L:5:20\n> 📌 **"revenue growth"** (chars 5–20)\n\nOld side comment',
      });
      provider.setComments([comment]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toContain('[Old]');
    });

    it('should show [New] for ^gn comment with R side', async () => {
      provider.setComments([makeGnComment({ id: 1 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toContain('[New]');
    });

    it('should show no indicator when side is undefined', async () => {
      provider.setComments([makeComment({ id: 1, side: undefined as unknown as string, line: 10 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).not.toContain('[Old]');
      expect(item.description).not.toContain('[New]');
    });

    it('should show no indicator when side is empty string', async () => {
      provider.setComments([makeComment({ id: 1, side: '', line: 10 })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).not.toContain('[Old]');
      expect(item.description).not.toContain('[New]');
    });

    it('should place side indicator at end of description', async () => {
      provider.setComments([makeComment({ id: 1, side: 'RIGHT', line: 10, userLogin: 'pedro' })]);
      const roots = await provider.getChildren();
      const children = await provider.getChildren(roots[0] as FileItem);
      const item = children[0] as CommentItem;
      expect(item.description).toMatch(/\[New\]$/);
    });
  });

  describe('dispose', () => {
    it('should clean up without errors', () => {
      expect(() => provider.dispose()).not.toThrow();
    });
  });

  describe('revealByCommentId — bidirectional navigation', () => {
    it('should call treeView.reveal with the matching CommentItem', () => {
      const treeView = window.createTreeView('gitnotateComments', {
        treeDataProvider: provider,
      });
      provider.registerTreeView(treeView as any);
      provider.setComments([makeComment({ id: 42, path: 'docs/proposal.md', line: 10 })]);

      provider.revealByCommentId(42);

      expect(treeView.reveal).toHaveBeenCalledOnce();
      const revealedItem = (treeView.reveal as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(revealedItem).toBeInstanceOf(CommentItem);
      expect(revealedItem.commentId).toBe(42);
    });

    it('should pass select: true, focus: false, expand: true as reveal options', () => {
      const treeView = window.createTreeView('gitnotateComments', {
        treeDataProvider: provider,
      });
      provider.registerTreeView(treeView as any);
      provider.setComments([makeComment({ id: 42, path: 'docs/proposal.md', line: 10 })]);

      provider.revealByCommentId(42);

      expect(treeView.reveal).toHaveBeenCalledWith(expect.any(CommentItem), {
        select: true,
        focus: false,
        expand: true,
      });
    });

    it('should not call reveal when commentId is not found', () => {
      const treeView = window.createTreeView('gitnotateComments', {
        treeDataProvider: provider,
      });
      provider.registerTreeView(treeView as any);
      provider.setComments([makeComment({ id: 1, path: 'docs/proposal.md' })]);

      provider.revealByCommentId(9999);

      expect(treeView.reveal).not.toHaveBeenCalled();
    });

    it('should gracefully no-op when no treeView is registered', () => {
      provider.setComments([makeComment({ id: 1, path: 'docs/proposal.md' })]);
      expect(() => provider.revealByCommentId(1)).not.toThrow();
    });

    it('should find comment items across multiple file groups', () => {
      const treeView = window.createTreeView('gitnotateComments', {
        treeDataProvider: provider,
      });
      provider.registerTreeView(treeView as any);
      provider.setComments([
        makeComment({ id: 1, path: 'a.md', line: 5 }),
        makeComment({ id: 2, path: 'b.md', line: 10 }),
      ]);

      provider.revealByCommentId(2);

      expect(treeView.reveal).toHaveBeenCalledOnce();
      const revealedItem = (treeView.reveal as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(revealedItem.commentId).toBe(2);
    });
  });
});
