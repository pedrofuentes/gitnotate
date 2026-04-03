import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scanConversationComments,
  findConversationCodeCell,
  processConversationComments,
} from '../../src/content/conversation-processor';

/**
 * Build a GitHub conversation-view timeline thread DOM.
 *
 * In the Conversation tab, each inline review comment thread appears as
 * a timeline item with:
 *   1. A code snippet table showing context lines
 *   2. One or more comment bodies below the snippet
 *
 * Unlike the Changes/Files tab, there is no wrapping `.file[data-path]`
 * container. The thread container itself may carry `data-path` in some
 * GitHub layouts, or the path may only appear as link text.
 */
function buildConversationThread(opts: {
  filePath?: string;
  codeLines: { number: number; text: string }[];
  comments: { bodyHTML: string }[];
  threadAttrs?: Record<string, string>;
}): HTMLElement {
  const timelineItem = document.createElement('div');
  timelineItem.className = 'js-timeline-item';

  const thread = document.createElement('div');
  thread.setAttribute('data-testid', 'review-thread');
  if (opts.filePath) {
    thread.setAttribute('data-path', opts.filePath);
  }
  for (const [key, value] of Object.entries(opts.threadAttrs ?? {})) {
    thread.setAttribute(key, value);
  }

  // Code snippet table
  const table = document.createElement('table');
  table.className = 'd-block';
  const tbody = document.createElement('tbody');

  for (const line of opts.codeLines) {
    const tr = document.createElement('tr');

    const numTd = document.createElement('td');
    numTd.className = 'blob-num';
    numTd.setAttribute('data-line-number', String(line.number));
    tr.appendChild(numTd);

    const codeTd = document.createElement('td');
    codeTd.className = 'blob-code blob-code-inner';
    codeTd.textContent = line.text;
    tr.appendChild(codeTd);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  thread.appendChild(table);

  // Comment bodies
  for (const comment of opts.comments) {
    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body markdown-body';
    commentBody.setAttribute('data-testid', 'markdown-body');
    commentBody.innerHTML = comment.bodyHTML;
    thread.appendChild(commentBody);
  }

  timelineItem.appendChild(thread);
  return timelineItem;
}

function gnTag(line: number, start: number, end: number, side: 'L' | 'R' = 'R'): string {
  return `^gn:${line}:${side}:${start}:${end}`;
}

function gnCommentHTML(line: number, start: number, end: number, userComment?: string, side: 'L' | 'R' = 'R'): string {
  const tag = gnTag(line, start, end, side);
  if (userComment) {
    return `<p>${tag}</p><p>${userComment}</p>`;
  }
  return `<p>${tag}</p>`;
}

// ─── scanConversationComments ───────────────────────────────────

describe('scanConversationComments', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find ^gn comments in conversation timeline threads', () => {
    const thread = buildConversationThread({
      filePath: 'edge-cases.md',
      codeLines: [{ number: 7, text: 'In Q3, our revenue growth exceeded expectations by a significant margin.' }],
      comments: [{ bodyHTML: gnCommentHTML(7, 23, 112, 'Test comment 1') }],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.lineNumber).toBe(7);
    expect(results[0].parsed.metadata.start).toBe(23);
    expect(results[0].parsed.metadata.end).toBe(112);
  });

  it('should return empty array when no ^gn comments exist', () => {
    const thread = buildConversationThread({
      filePath: 'readme.md',
      codeLines: [{ number: 1, text: 'Hello world' }],
      comments: [{ bodyHTML: '<p>Looks good to me!</p>' }],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toEqual([]);
  });

  it('should work without data-path on thread container', () => {
    // Conversation DOM may not always have data-path
    const thread = buildConversationThread({
      codeLines: [{ number: 15, text: 'const x = compute();' }],
      comments: [{ bodyHTML: gnCommentHTML(15, 0, 15, 'prueba cafe') }],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.start).toBe(0);
    expect(results[0].parsed.metadata.end).toBe(15);
  });

  it('should find multiple ^gn comments across different threads', () => {
    const thread1 = buildConversationThread({
      filePath: 'edge-cases.md',
      codeLines: [{ number: 7, text: 'Line seven content' }],
      comments: [{ bodyHTML: gnCommentHTML(7, 0, 10, 'Comment A') }],
    });
    const thread2 = buildConversationThread({
      filePath: 'notes.md',
      codeLines: [{ number: 3, text: 'Line three content' }],
      comments: [{ bodyHTML: gnCommentHTML(3, 5, 18, 'Comment B') }],
    });
    document.body.appendChild(thread1);
    document.body.appendChild(thread2);

    const results = scanConversationComments();

    expect(results).toHaveLength(2);
    expect(results[0].parsed.metadata.lineNumber).toBe(7);
    expect(results[1].parsed.metadata.lineNumber).toBe(3);
  });

  it('should ignore reply comments without ^gn metadata', () => {
    const thread = buildConversationThread({
      filePath: 'edge-cases.md',
      codeLines: [{ number: 15, text: 'Some code here' }],
      comments: [
        { bodyHTML: gnCommentHTML(15, 0, 10, 'Original gitnotate comment') },
        { bodyHTML: '<p>Just a regular reply</p>' },
      ],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toHaveLength(1);
  });

  it('should parse L-side metadata correctly', () => {
    const thread = buildConversationThread({
      filePath: 'old-code.ts',
      codeLines: [{ number: 10, text: 'const removed = true;' }],
      comments: [{ bodyHTML: gnCommentHTML(10, 6, 13, 'Why removed?', 'L') }],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.side).toBe('L');
  });

  it('should return threadContainer reference for each comment', () => {
    const thread = buildConversationThread({
      filePath: 'file.ts',
      codeLines: [{ number: 1, text: 'hello' }],
      comments: [{ bodyHTML: gnCommentHTML(1, 0, 5, 'Greeting') }],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toHaveLength(1);
    expect(results[0].threadContainer).toBeInstanceOf(HTMLElement);
    // Thread container should be an ancestor of the comment
    expect(results[0].threadContainer.contains(results[0].commentElement)).toBe(true);
  });

  it('should deduplicate identical ^gn tags', () => {
    // Same ^gn tag appearing twice (e.g., GitHub preview + rendered)
    const thread = buildConversationThread({
      filePath: 'file.ts',
      codeLines: [{ number: 1, text: 'hello world' }],
      comments: [
        { bodyHTML: gnCommentHTML(1, 0, 5, 'First') },
        { bodyHTML: gnCommentHTML(1, 0, 5, 'Duplicate') },
      ],
    });
    document.body.appendChild(thread);

    const results = scanConversationComments();

    expect(results).toHaveLength(1);
  });
});

// ─── findConversationCodeCell ───────────────────────────────────

describe('findConversationCodeCell', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find the code cell matching the line number in a thread', () => {
    const thread = buildConversationThread({
      codeLines: [
        { number: 5, text: 'context line' },
        { number: 6, text: 'context line 2' },
        { number: 7, text: 'The commented line content here' },
      ],
      comments: [{ bodyHTML: gnCommentHTML(7, 4, 18) }],
    });
    document.body.appendChild(thread);

    const threadContainer = thread.querySelector('[data-testid="review-thread"]') as HTMLElement;
    const cell = findConversationCodeCell(threadContainer, 7);

    expect(cell).not.toBeNull();
    expect(cell!.textContent).toBe('The commented line content here');
  });

  it('should return null when line number is not in the snippet', () => {
    const thread = buildConversationThread({
      codeLines: [{ number: 5, text: 'only line 5' }],
      comments: [{ bodyHTML: gnCommentHTML(10, 0, 5) }],
    });
    document.body.appendChild(thread);

    const threadContainer = thread.querySelector('[data-testid="review-thread"]') as HTMLElement;
    const cell = findConversationCodeCell(threadContainer, 10);

    expect(cell).toBeNull();
  });

  it('should scope search to the specific thread container', () => {
    // Two threads with the same line number — should find the right one
    const thread1 = buildConversationThread({
      codeLines: [{ number: 7, text: 'Thread 1 line 7' }],
      comments: [{ bodyHTML: gnCommentHTML(7, 0, 8) }],
    });
    const thread2 = buildConversationThread({
      codeLines: [{ number: 7, text: 'Thread 2 line 7' }],
      comments: [{ bodyHTML: gnCommentHTML(7, 0, 8) }],
    });
    document.body.appendChild(thread1);
    document.body.appendChild(thread2);

    const container1 = thread1.querySelector('[data-testid="review-thread"]') as HTMLElement;
    const cell = findConversationCodeCell(container1, 7);

    expect(cell).not.toBeNull();
    expect(cell!.textContent).toBe('Thread 1 line 7');
  });

  it('should find code cell using diff-text-inner class (new GitHub UI)', () => {
    // Some GitHub layouts use diff-text-inner instead of blob-code-inner
    const thread = document.createElement('div');
    thread.setAttribute('data-testid', 'review-thread');

    const table = document.createElement('table');
    const tr = document.createElement('tr');
    const numTd = document.createElement('td');
    numTd.setAttribute('data-line-number', '3');
    tr.appendChild(numTd);

    const codeTd = document.createElement('td');
    const inner = document.createElement('span');
    inner.className = 'diff-text-inner';
    inner.textContent = 'New UI code cell';
    codeTd.appendChild(inner);
    tr.appendChild(codeTd);

    table.appendChild(tr);
    thread.appendChild(table);
    document.body.appendChild(thread);

    const cell = findConversationCodeCell(thread, 3);

    expect(cell).not.toBeNull();
    expect(cell!.textContent).toBe('New UI code cell');
  });
});

// ─── processConversationComments ────────────────────────────────

describe('processConversationComments', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should hide ^gn metadata in comment bodies', () => {
    const thread = buildConversationThread({
      filePath: 'edge-cases.md',
      codeLines: [{ number: 7, text: 'In Q3, our revenue growth exceeded expectations.' }],
      comments: [{ bodyHTML: gnCommentHTML(7, 23, 48, 'Test comment') }],
    });
    document.body.appendChild(thread);

    processConversationComments();

    // The ^gn tag paragraph should be hidden
    const paragraphs = thread.querySelectorAll('p');
    const gnParagraph = Array.from(paragraphs).find(p =>
      p.textContent?.includes('^gn:'),
    );
    // Either the element is display:none or the text is wrapped in a hidden span
    if (gnParagraph) {
      const isHidden =
        gnParagraph.style.display === 'none' ||
        gnParagraph.querySelector('span[style*="display: none"]') !== null;
      expect(isHidden).toBe(true);
    }
    // The user comment should still be visible
    const visibleText = thread.querySelector('.comment-body')?.textContent ?? '';
    expect(visibleText).toContain('Test comment');
  });

  it('should highlight the character range in the code snippet', () => {
    const thread = buildConversationThread({
      filePath: 'edge-cases.md',
      codeLines: [
        { number: 7, text: 'In Q3, our revenue growth exceeded expectations.' },
      ],
      comments: [{ bodyHTML: gnCommentHTML(7, 15, 30, 'Highlight this range') }],
    });
    document.body.appendChild(thread);

    processConversationComments();

    const highlight = thread.querySelector('.gn-highlight');
    expect(highlight).not.toBeNull();
    // The highlighted text should be "growth exceeded" (chars 15-30)
    expect(highlight!.textContent).toBe('growth exceeded');
  });

  it('should colorize the thread container', () => {
    const thread = buildConversationThread({
      filePath: 'edge-cases.md',
      codeLines: [{ number: 7, text: 'Some code content here for testing.' }],
      comments: [{ bodyHTML: gnCommentHTML(7, 5, 17, 'Check this') }],
      threadAttrs: { 'data-marker-id': 'test-marker' },
    });
    document.body.appendChild(thread);

    processConversationComments();

    const colorIndicator = thread.querySelector('[data-gn-color-indicator]');
    expect(colorIndicator).not.toBeNull();
  });

  it('should process multiple threads independently', () => {
    const thread1 = buildConversationThread({
      filePath: 'a.md',
      codeLines: [{ number: 1, text: 'alpha beta gamma delta' }],
      comments: [{ bodyHTML: gnCommentHTML(1, 0, 5, 'Comment A') }],
    });
    const thread2 = buildConversationThread({
      filePath: 'b.md',
      codeLines: [{ number: 10, text: 'epsilon zeta eta theta' }],
      comments: [{ bodyHTML: gnCommentHTML(10, 8, 12, 'Comment B') }],
    });
    document.body.appendChild(thread1);
    document.body.appendChild(thread2);

    processConversationComments();

    const highlights = document.querySelectorAll('.gn-highlight');
    expect(highlights).toHaveLength(2);
    expect(highlights[0].textContent).toBe('alpha');
    expect(highlights[1].textContent).toBe('zeta');
  });

  it('should not crash when code snippet has no matching line', () => {
    const thread = buildConversationThread({
      codeLines: [{ number: 5, text: 'line five' }],
      comments: [{ bodyHTML: gnCommentHTML(99, 0, 5, 'Wrong line ref') }],
    });
    document.body.appendChild(thread);

    // Should not throw
    expect(() => processConversationComments()).not.toThrow();

    // Metadata should still be hidden even without highlight
    const gnP = Array.from(thread.querySelectorAll('p')).find(p =>
      p.textContent?.includes('^gn:'),
    );
    if (gnP) {
      const isHidden =
        gnP.style.display === 'none' ||
        gnP.querySelector('span[style*="display: none"]') !== null;
      expect(isHidden).toBe(true);
    }
  });

  it('should skip regular comments without ^gn metadata', () => {
    const thread = buildConversationThread({
      codeLines: [{ number: 1, text: 'hello world' }],
      comments: [{ bodyHTML: '<p>regular comment</p>' }],
    });
    document.body.appendChild(thread);

    processConversationComments();

    const highlights = document.querySelectorAll('.gn-highlight');
    expect(highlights).toHaveLength(0);
  });
});
