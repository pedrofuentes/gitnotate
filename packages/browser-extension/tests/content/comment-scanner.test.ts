import { describe, it, expect, beforeEach } from 'vitest';
import { scanForGnComments, type GnReviewComment } from '../../src/content/comment-scanner';

/**
 * Helper: build a GitHub-like diff + review comment DOM structure.
 *
 * A `.file[data-path]` wraps a `.diff-table` with numbered lines.
 * Review comments sit inside the same `.file` container, after the
 * diff row they refer to.  The `@gn:start:end` tag lives inside a
 * `<code>` element (as GitHub renders backtick code spans).
 */
function buildDiffFileDOM(opts: {
  filePath: string;
  lines: { number: number; text: string }[];
  comments?: {
    line: number;
    bodyHTML: string;
  }[];
  useDataDiffAnchor?: boolean;
}): HTMLElement {
  const file = document.createElement('div');
  file.className = 'file';
  if (opts.useDataDiffAnchor) {
    file.setAttribute('data-diff-anchor', opts.filePath);
  } else {
    file.setAttribute('data-path', opts.filePath);
  }

  const table = document.createElement('table');
  table.className = 'diff-table';
  const tbody = document.createElement('tbody');

  for (const line of opts.lines) {
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
  file.appendChild(table);

  for (const comment of opts.comments ?? []) {
    const reviewComment = document.createElement('div');
    reviewComment.className = 'review-comment';
    reviewComment.setAttribute('data-line-number', String(comment.line));

    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';
    commentBody.innerHTML = comment.bodyHTML;
    reviewComment.appendChild(commentBody);

    file.appendChild(reviewComment);
  }

  return file;
}

/**
 * Build a @gn comment body HTML using the `@gn:start:end` format.
 *
 * The tag is rendered inside a `<code>` element (as GitHub renders
 * backtick code spans).  Backtick text nodes surround the `<code>`
 * so that the container's textContent includes the backticks the
 * parser requires.
 */
function gnCommentHTML(start: number, end: number, userComment?: string): string {
  const tag = `\`<code>@gn:${start}:${end}</code>\``;
  return userComment ? `${tag} ${userComment}` : tag;
}

const PLAIN_COMMENT_HTML = '<p>Looks good to me!</p>';

describe('scanForGnComments', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find @gn comments in review comment elements', () => {
    const file = buildDiffFileDOM({
      filePath: 'docs/proposal.md',
      lines: [
        { number: 3, text: 'In Q3, our revenue growth exceeded expectations by a significant margin.' },
      ],
      comments: [
        {
          line: 3,
          bodyHTML: gnCommentHTML(11, 47, 'Can we add the exact percentage here?'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.start).toBe(11);
    expect(results[0].parsed.metadata.end).toBe(47);
    expect(results[0].parsed.metadata.exact).toBe('');
    expect(results[0].parsed.userComment).toBe('Can we add the exact percentage here?');
  });

  it('should return empty array when no @gn comments exist', () => {
    const file = buildDiffFileDOM({
      filePath: 'docs/readme.md',
      lines: [{ number: 1, text: 'Hello world' }],
      comments: [{ line: 1, bodyHTML: PLAIN_COMMENT_HTML }],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toEqual([]);
  });

  it('should parse metadata correctly from comment body', () => {
    const file = buildDiffFileDOM({
      filePath: 'src/index.ts',
      lines: [{ number: 10, text: 'const result = compute(x, y);' }],
      comments: [
        {
          line: 10,
          bodyHTML: gnCommentHTML(15, 29, 'Should we validate inputs first?'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata).toEqual({
      exact: '',
      start: 15,
      end: 29,
    });
    expect(results[0].parsed.userComment).toBe('Should we validate inputs first?');
  });

  it('should extract file path from parent structure', () => {
    const file = buildDiffFileDOM({
      filePath: 'packages/core/src/utils.ts',
      lines: [{ number: 5, text: 'export function helper() {}' }],
      comments: [
        {
          line: 5,
          bodyHTML: gnCommentHTML(16, 22, 'Rename this function'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('packages/core/src/utils.ts');
  });

  it('should extract line number from comment element', () => {
    const file = buildDiffFileDOM({
      filePath: 'file.ts',
      lines: [{ number: 42, text: 'some code' }],
      comments: [
        {
          line: 42,
          bodyHTML: gnCommentHTML(5, 9, 'Clarify this'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(42);
  });

  it('should ignore regular (non-@gn) review comments', () => {
    const file = buildDiffFileDOM({
      filePath: 'file.ts',
      lines: [
        { number: 1, text: 'line one' },
        { number: 2, text: 'line two' },
      ],
      comments: [
        { line: 1, bodyHTML: PLAIN_COMMENT_HTML },
        {
          line: 2,
          bodyHTML: gnCommentHTML(5, 8, 'Fix this'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(2);
  });

  it('should handle multiple @gn comments on the same page', () => {
    const file1 = buildDiffFileDOM({
      filePath: 'a.ts',
      lines: [{ number: 1, text: 'alpha beta gamma' }],
      comments: [
        {
          line: 1,
          bodyHTML: gnCommentHTML(0, 5, 'Comment A'),
        },
      ],
    });

    const file2 = buildDiffFileDOM({
      filePath: 'b.ts',
      lines: [{ number: 7, text: 'delta epsilon' }],
      comments: [
        {
          line: 7,
          bodyHTML: gnCommentHTML(6, 13, 'Comment B'),
        },
      ],
    });

    document.body.appendChild(file1);
    document.body.appendChild(file2);

    const results = scanForGnComments();

    expect(results).toHaveLength(2);
    expect(results[0].filePath).toBe('a.ts');
    expect(results[0].parsed.metadata.start).toBe(0);
    expect(results[0].parsed.metadata.end).toBe(5);
    expect(results[1].filePath).toBe('b.ts');
    expect(results[1].parsed.metadata.start).toBe(6);
    expect(results[1].parsed.metadata.end).toBe(13);
  });

  it('should return the comment DOM element reference', () => {
    const file = buildDiffFileDOM({
      filePath: 'file.ts',
      lines: [{ number: 1, text: 'hello world' }],
      comments: [
        {
          line: 1,
          bodyHTML: gnCommentHTML(0, 5, 'Greeting'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].commentElement).toBeInstanceOf(HTMLElement);
    expect(results[0].commentElement.classList.contains('comment-body')).toBe(true);
  });

  it('should handle @gn tag inside a paragraph with code element', () => {
    const file = buildDiffFileDOM({
      filePath: 'file.ts',
      lines: [{ number: 1, text: 'hello world' }],
      comments: [
        {
          line: 1,
          bodyHTML: '<p>`<code>@gn:0:5</code>` Review this greeting</p>',
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.start).toBe(0);
    expect(results[0].parsed.metadata.end).toBe(5);
  });

  it('should resolve file path from data-diff-anchor attribute', () => {
    const file = buildDiffFileDOM({
      filePath: 'README.md',
      lines: [{ number: 1, text: 'Hello world' }],
      comments: [
        {
          line: 1,
          bodyHTML: gnCommentHTML(0, 5, 'Use greeting'),
        },
      ],
      useDataDiffAnchor: true,
    });

    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('README.md');
  });
});
