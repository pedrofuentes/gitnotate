import { describe, it, expect, beforeEach } from 'vitest';
import { scanForGnComments, type GnReviewComment } from '../../src/content/comment-scanner';

/**
 * Helper: build a GitHub-like diff + review comment DOM structure.
 *
 * A `.file[data-path]` wraps a `.diff-table` with numbered lines.
 * Review comments sit inside the same `.file` container, after the
 * diff row they refer to.
 */
function buildDiffFileDOM(opts: {
  filePath: string;
  lines: { number: number; text: string }[];
  comments?: {
    line: number;
    bodyHTML: string;
  }[];
}): HTMLElement {
  const file = document.createElement('div');
  file.className = 'file';
  file.setAttribute('data-path', opts.filePath);

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
    reviewComment.setAttribute('data-line', String(comment.line));

    const commentBody = document.createElement('div');
    commentBody.className = 'comment-body';
    commentBody.innerHTML = comment.bodyHTML;
    reviewComment.appendChild(commentBody);

    file.appendChild(reviewComment);
  }

  return file;
}

const GN_COMMENT_HTML = [
  '<p>&lt;!-- @gn {"exact":"revenue growth exceeded expectations","start":11,"end":47} --&gt;</p>',
  '<blockquote>📌 <strong>"revenue growth exceeded expectations"</strong> (chars 11–47)</blockquote>',
  '<p>Can we add the exact percentage here?</p>',
].join('\n');

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
      comments: [{ line: 3, bodyHTML: GN_COMMENT_HTML }],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.exact).toBe('revenue growth exceeded expectations');
    expect(results[0].parsed.metadata.start).toBe(11);
    expect(results[0].parsed.metadata.end).toBe(47);
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
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"compute(x, y)","start":15,"end":29} --&gt;</p>',
            '<blockquote>📌 <strong>"compute(x, y)"</strong> (chars 15–29)</blockquote>',
            '<p>Should we validate inputs first?</p>',
          ].join('\n'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata).toEqual({
      exact: 'compute(x, y)',
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
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"helper","start":16,"end":22} --&gt;</p>',
            '<blockquote>📌 <strong>"helper"</strong> (chars 16–22)</blockquote>',
            '<p>Rename this function</p>',
          ].join('\n'),
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
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"code","start":5,"end":9} --&gt;</p>',
            '<blockquote>📌 <strong>"code"</strong> (chars 5–9)</blockquote>',
            '<p>Clarify this</p>',
          ].join('\n'),
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
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"two","start":5,"end":8} --&gt;</p>',
            '<blockquote>📌 <strong>"two"</strong> (chars 5–8)</blockquote>',
            '<p>Fix this</p>',
          ].join('\n'),
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
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"alpha","start":0,"end":5} --&gt;</p>',
            '<blockquote>📌 <strong>"alpha"</strong> (chars 0–5)</blockquote>',
            '<p>Comment A</p>',
          ].join('\n'),
        },
      ],
    });

    const file2 = buildDiffFileDOM({
      filePath: 'b.ts',
      lines: [{ number: 7, text: 'delta epsilon' }],
      comments: [
        {
          line: 7,
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"epsilon","start":6,"end":13} --&gt;</p>',
            '<blockquote>📌 <strong>"epsilon"</strong> (chars 6–13)</blockquote>',
            '<p>Comment B</p>',
          ].join('\n'),
        },
      ],
    });

    document.body.appendChild(file1);
    document.body.appendChild(file2);

    const results = scanForGnComments();

    expect(results).toHaveLength(2);
    expect(results[0].filePath).toBe('a.ts');
    expect(results[0].parsed.metadata.exact).toBe('alpha');
    expect(results[1].filePath).toBe('b.ts');
    expect(results[1].parsed.metadata.exact).toBe('epsilon');
  });

  it('should return the comment DOM element reference', () => {
    const file = buildDiffFileDOM({
      filePath: 'file.ts',
      lines: [{ number: 1, text: 'hello world' }],
      comments: [
        {
          line: 1,
          bodyHTML: [
            '<p>&lt;!-- @gn {"exact":"hello","start":0,"end":5} --&gt;</p>',
            '<blockquote>📌 <strong>"hello"</strong> (chars 0–5)</blockquote>',
            '<p>Greeting</p>',
          ].join('\n'),
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].commentElement).toBeInstanceOf(HTMLElement);
    expect(results[0].commentElement.classList.contains('review-comment')).toBe(true);
  });

  it('should handle @gn metadata when HTML comment is rendered as visible text', () => {
    // Some GitHub rendering may show the <!-- --> as escaped text in textContent
    const file = buildDiffFileDOM({
      filePath: 'file.ts',
      lines: [{ number: 1, text: 'hello world' }],
      comments: [
        {
          line: 1,
          bodyHTML:
            '<!-- @gn {"exact":"hello","start":0,"end":5} -->\n<blockquote>📌 <strong>"hello"</strong> (chars 0–5)</blockquote>\n<p>Hidden meta</p>',
        },
      ],
    });
    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.exact).toBe('hello');
  });

  it('should handle timeline-comment variant selector', () => {
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'README.md');

    const table = document.createElement('table');
    table.className = 'diff-table';
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    const numTd = document.createElement('td');
    numTd.className = 'blob-num';
    numTd.setAttribute('data-line-number', '1');
    tr.appendChild(numTd);
    const codeTd = document.createElement('td');
    codeTd.className = 'blob-code blob-code-inner';
    codeTd.textContent = 'Hello world';
    tr.appendChild(codeTd);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    file.appendChild(table);

    // Use timeline-comment variant
    const comment = document.createElement('div');
    comment.className = 'timeline-comment';
    comment.setAttribute('data-line', '1');
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.innerHTML = [
      '<p>&lt;!-- @gn {"exact":"Hello","start":0,"end":5} --&gt;</p>',
      '<blockquote>📌 <strong>"Hello"</strong> (chars 0–5)</blockquote>',
      '<p>Use greeting</p>',
    ].join('\n');
    comment.appendChild(body);
    file.appendChild(comment);

    document.body.appendChild(file);

    const results = scanForGnComments();

    expect(results).toHaveLength(1);
    expect(results[0].parsed.metadata.exact).toBe('Hello');
  });
});
