import { describe, it, expect, beforeEach } from 'vitest';
import {
  highlightTextRange,
  clearAllHighlights,
  clearHighlight,
  resetColorCounters,
  type HighlightInfo,
} from '../../src/content/highlighter';

/**
 * Build a minimal diff line DOM: a `.file[data-path]` with a single
 * `.diff-table` row containing `.blob-num[data-line-number]` and
 * `.blob-code.blob-code-inner` with the given text.
 */
function buildDiffLine(filePath: string, lineNumber: number, text: string): HTMLElement {
  const file = document.createElement('div');
  file.className = 'file';
  file.setAttribute('data-path', filePath);

  const table = document.createElement('table');
  table.className = 'diff-table';
  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');

  const numTd = document.createElement('td');
  numTd.className = 'blob-num';
  numTd.setAttribute('data-line-number', String(lineNumber));
  tr.appendChild(numTd);

  const codeTd = document.createElement('td');
  codeTd.className = 'blob-code blob-code-inner';
  codeTd.textContent = text;
  tr.appendChild(codeTd);

  tbody.appendChild(tr);
  table.appendChild(tbody);
  file.appendChild(table);

  return file;
}

/**
 * Build a new GitHub UI diff line: line number and code content are in
 * SIBLING `<td>` elements within the same `<tr>`, wrapped in a
 * `[data-diff-anchor]` table.
 */
function buildNewUiDiffLine(filePath: string, lineNumber: number, text: string): HTMLElement {
  const table = document.createElement('table');
  table.setAttribute('data-diff-anchor', filePath);

  const tr = document.createElement('tr');

  // Left side: empty (new file addition)
  const emptyLeft = document.createElement('td');
  emptyLeft.className = 'focusable-grid-cell empty-diff-line left-side';
  tr.appendChild(emptyLeft);

  // Right side: line number cell
  const numTd = document.createElement('td');
  numTd.setAttribute('data-line-number', String(lineNumber));
  numTd.className = 'focusable-grid-cell';
  tr.appendChild(numTd);

  // Right side: code cell
  const codeTd = document.createElement('td');
  codeTd.className = 'focusable-grid-cell';
  const codeInner = document.createElement('div');
  codeInner.className = 'diff-text-inner';
  codeInner.textContent = text;
  codeTd.appendChild(codeInner);
  tr.appendChild(codeTd);

  table.appendChild(tr);
  return table;
}

function makeInfo(overrides: Partial<HighlightInfo> = {}): HighlightInfo {
  return {
    filePath: 'docs/proposal.md',
    lineNumber: 3,
    side: 'R' as const,
    start: 11,
    end: 47,
    commentId: 'c1',
    ...overrides,
  };
}

describe('highlightTextRange', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should highlight a text range within a line element', () => {
    const file = buildDiffLine(
      'docs/proposal.md',
      3,
      'In Q3, our revenue growth exceeded expectations by a significant margin.',
    );
    document.body.appendChild(file);

    const result = highlightTextRange(makeInfo());

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('revenue growth exceeded expectations');
  });

  it('should create a span with gn-highlight class', () => {
    const file = buildDiffLine('docs/proposal.md', 3, 'In Q3, our revenue growth exceeded expectations by a significant margin.');
    document.body.appendChild(file);

    const result = highlightTextRange(makeInfo());

    expect(result).not.toBeNull();
    expect(result!.span.classList.contains('gn-highlight')).toBe(true);
  });

  it('should set data-gn-comment-id attribute', () => {
    const file = buildDiffLine('docs/proposal.md', 3, 'In Q3, our revenue growth exceeded expectations by a significant margin.');
    document.body.appendChild(file);

    const result = highlightTextRange(makeInfo({ commentId: 'review-42' }));

    expect(result).not.toBeNull();
    expect(result!.span.getAttribute('data-gn-comment-id')).toBe('review-42');
  });

  it('should handle text offsets correctly', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'c2' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('beta');
  });

  it('should handle offset at start of line (start=0)', () => {
    const file = buildDiffLine('file.ts', 1, 'hello world');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 0, end: 5, commentId: 'c3' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('hello');
  });

  it('should handle offset at end of line', () => {
    const text = 'hello world';
    const file = buildDiffLine('file.ts', 1, text);
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({
        filePath: 'file.ts',
        lineNumber: 1,
        start: 6,
        end: text.length,
        commentId: 'c4',
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('world');
  });

  it('should handle offset beyond line length gracefully (no crash)', () => {
    const file = buildDiffLine('file.ts', 1, 'short');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 100, end: 200, commentId: 'c5' }),
    );

    expect(result).toBeNull();
  });

  it('should return null when file element is not found', () => {
    // No DOM elements added
    const result = highlightTextRange(makeInfo({ filePath: 'missing.ts' }));

    expect(result).toBeNull();
  });

  it('should return null when line number is not found', () => {
    const file = buildDiffLine('file.ts', 1, 'hello');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 999, commentId: 'c6' }),
    );

    expect(result).toBeNull();
  });

  it('should highlight in new GitHub UI where line number and code are sibling cells', () => {
    const table = buildNewUiDiffLine('diff-abc123', 35, 'The system uses PostgreSQL as the primary database.');
    document.body.appendChild(table);

    const result = highlightTextRange(
      makeInfo({ filePath: 'diff-abc123', lineNumber: 35, start: 16, end: 26, commentId: 'new-ui-1' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('PostgreSQL');
  });

  it('should find code cell in new UI even without blob-num class', () => {
    const table = buildNewUiDiffLine('diff-xyz', 10, 'import React from "react";');
    document.body.appendChild(table);

    const result = highlightTextRange(
      makeInfo({ filePath: 'diff-xyz', lineNumber: 10, start: 7, end: 12, commentId: 'new-ui-2' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('React');
  });

  it('should highlight L-side text in old GitHub UI', () => {
    const file = buildDiffLine('file.ts', 5, 'const old = true;');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 5, side: 'L', start: 6, end: 9, commentId: 'left-1' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('old');
  });

  it('should highlight L-side text using data-diff-side selector', () => {
    // Build a split-view row with left and right sides
    const table = document.createElement('table');
    table.setAttribute('data-diff-anchor', 'split.ts');
    const tr = document.createElement('tr');

    // Left side: line number + code
    const leftNum = document.createElement('td');
    leftNum.setAttribute('data-line-number', '10');
    leftNum.setAttribute('data-diff-side', 'left');
    tr.appendChild(leftNum);

    const leftCode = document.createElement('td');
    leftCode.setAttribute('data-diff-side', 'left');
    const leftInner = document.createElement('div');
    leftInner.className = 'diff-text-inner';
    leftInner.textContent = 'removed line content';
    leftCode.appendChild(leftInner);
    tr.appendChild(leftCode);

    // Right side: line number + code
    const rightNum = document.createElement('td');
    rightNum.setAttribute('data-line-number', '10');
    rightNum.setAttribute('data-diff-side', 'right');
    tr.appendChild(rightNum);

    const rightCode = document.createElement('td');
    rightCode.setAttribute('data-diff-side', 'right');
    const rightInner = document.createElement('div');
    rightInner.className = 'diff-text-inner';
    rightInner.textContent = 'added line content';
    rightCode.appendChild(rightInner);
    tr.appendChild(rightCode);

    table.appendChild(tr);
    document.body.appendChild(table);

    const result = highlightTextRange(
      makeInfo({ filePath: 'split.ts', lineNumber: 10, side: 'L', start: 0, end: 7, commentId: 'left-split' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('removed');
  });
});

describe('clearHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should clear a specific highlight by comment ID', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 0, end: 5, commentId: 'keep' }),
    );
    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'remove' }),
    );

    expect(document.querySelectorAll('.gn-highlight')).toHaveLength(2);

    clearHighlight('remove');

    const remaining = document.querySelectorAll('.gn-highlight');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].getAttribute('data-gn-comment-id')).toBe('keep');
  });

  it('should not crash when clearing a non-existent highlight', () => {
    expect(() => clearHighlight('does-not-exist')).not.toThrow();
  });
});

describe('clearAllHighlights', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should clear all highlights', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 0, end: 5, commentId: 'h1' }),
    );
    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'h2' }),
    );

    expect(document.querySelectorAll('.gn-highlight')).toHaveLength(2);

    clearAllHighlights();

    expect(document.querySelectorAll('.gn-highlight')).toHaveLength(0);
  });

  it('should restore original text content after clearing', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'h1' }),
    );

    clearAllHighlights();

    const codeCell = document.querySelector('.blob-code-inner');
    expect(codeCell?.textContent).toBe('alpha beta gamma');
  });
});

describe('SEC-01: CSS selector injection via filePath', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetColorCounters();
  });

  it('should handle filePath containing double quotes without throwing', () => {
    const maliciousPath = 'file"with"quotes.ts';
    const file = buildDiffLine(maliciousPath, 1, 'hello world');
    document.body.appendChild(file);

    expect(() =>
      highlightTextRange(
        makeInfo({ filePath: maliciousPath, lineNumber: 1, start: 0, end: 5, commentId: 'sec1a' }),
      ),
    ).not.toThrow();
  });

  it('should handle filePath containing square brackets', () => {
    const bracketPath = 'src/[id]/page.tsx';
    const file = buildDiffLine(bracketPath, 1, 'hello world');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: bracketPath, lineNumber: 1, start: 0, end: 5, commentId: 'sec1b' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('hello');
  });

  it('should handle filePath with CSS selector special characters', () => {
    const specialPath = 'path/to/file#1.component.test.ts';
    const file = buildDiffLine(specialPath, 1, 'const x = 1;');
    document.body.appendChild(file);

    const result = highlightTextRange(
      makeInfo({ filePath: specialPath, lineNumber: 1, start: 6, end: 7, commentId: 'sec1c' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('x');
  });
});

describe('SEC-02: unprotected JSON.parse of data-gn-metadata', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetColorCounters();
  });

  it('should not throw when data-gn-metadata contains invalid JSON', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    // First highlight to create the td with metadata
    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 0, end: 5, commentId: 'sec2a' }),
    );

    // Corrupt the metadata attribute
    const td = document.querySelector('td.blob-code');
    td?.setAttribute('data-gn-metadata', '{not valid json!!!');

    // Second highlight on same line should not throw
    expect(() =>
      highlightTextRange(
        makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'sec2b' }),
      ),
    ).not.toThrow();
  });

  it('should still create highlight when metadata is corrupted', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 0, end: 5, commentId: 'sec2c' }),
    );

    // Corrupt metadata
    const td = document.querySelector('td.blob-code');
    td?.setAttribute('data-gn-metadata', 'corrupt');

    const result = highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'sec2d' }),
    );

    expect(result).not.toBeNull();
    expect(result!.span.textContent).toBe('beta');
  });

  it('should reset metadata to valid state after encountering corruption', () => {
    const file = buildDiffLine('file.ts', 1, 'alpha beta gamma');
    document.body.appendChild(file);

    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 0, end: 5, commentId: 'sec2e' }),
    );

    // Corrupt metadata
    const td = document.querySelector('td.blob-code');
    td?.setAttribute('data-gn-metadata', 'not-json');

    highlightTextRange(
      makeInfo({ filePath: 'file.ts', lineNumber: 1, start: 6, end: 10, commentId: 'sec2f' }),
    );

    // Metadata should be valid JSON again
    const metadata = td?.getAttribute('data-gn-metadata');
    expect(() => JSON.parse(metadata!)).not.toThrow();
  });
});
