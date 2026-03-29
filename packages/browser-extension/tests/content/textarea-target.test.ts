import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findClosestTextarea,
  injectGnMetadata,
  isTextareaNearSelection,
  getTextareaLineNumbers,
  TEXTAREA_SELECTORS,
} from '../../src/content/textarea-target';
import type { TextSelectionInfo } from '../../src/content/selection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSelectionInfo(
  overrides: Partial<TextSelectionInfo> = {},
): TextSelectionInfo {
  const el = document.createElement('td');
  el.className = 'blob-code blob-code-inner';
  el.textContent = 'some code text here';

  return {
    exact: 'code',
    start: 5,
    end: 9,
    lineNumber: 7,
    filePath: 'src/index.ts',
    side: 'RIGHT' as const,
    lineElement: el,
    ...overrides,
  };
}

/**
 * Build a minimal GitHub-like diff structure with N files, each containing
 * some code rows and optionally an inline comment textarea on certain lines.
 *
 * Returns the root container and references to each textarea and code cell.
 */
function buildDiffDom(
  files: Array<{
    path: string;
    lines: Array<{
      num: number;
      code: string;
      hasTextarea?: boolean;
    }>;
  }>,
): {
  root: HTMLElement;
  textareas: HTMLTextAreaElement[];
  codeCells: Map<string, HTMLElement>; // key: "filePath:lineNum"
} {
  const root = document.createElement('div');
  const textareas: HTMLTextAreaElement[] = [];
  const codeCells = new Map<string, HTMLElement>();

  for (const file of files) {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file';
    fileDiv.setAttribute('data-path', file.path);

    const table = document.createElement('table');

    for (const line of file.lines) {
      // Code row
      const codeRow = document.createElement('tr');
      const numCell = document.createElement('td');
      numCell.className = 'blob-num';
      numCell.setAttribute('data-line-number', String(line.num));
      const codeCell = document.createElement('td');
      codeCell.className = 'blob-code blob-code-inner';
      codeCell.textContent = line.code;
      codeRow.appendChild(numCell);
      codeRow.appendChild(codeCell);
      table.appendChild(codeRow);
      codeCells.set(`${file.path}:${line.num}`, codeCell);

      // Inline comment row (if requested)
      if (line.hasTextarea) {
        const commentRow = document.createElement('tr');
        commentRow.className = 'inline-comments';
        const commentCell = document.createElement('td');
        commentCell.colSpan = 2;
        const form = document.createElement('div');
        form.className = 'inline-comment-form';
        const ta = document.createElement('textarea');
        ta.name = 'comment[body]';
        // Make it "visible" for the finder
        Object.defineProperty(ta, 'offsetParent', { value: form, configurable: true });
        Object.defineProperty(ta, 'offsetHeight', { value: 100, configurable: true });
        form.appendChild(ta);
        commentCell.appendChild(form);
        commentRow.appendChild(commentCell);
        table.appendChild(commentRow);
        textareas.push(ta);
      }
    }

    fileDiv.appendChild(table);
    root.appendChild(fileDiv);
  }

  document.body.appendChild(root);
  return { root, textareas, codeCells };
}

// ---------------------------------------------------------------------------
// findClosestTextarea
// ---------------------------------------------------------------------------

describe('findClosestTextarea', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return null when no textareas exist', () => {
    expect(findClosestTextarea()).toBeNull();
  });

  it('should return the only visible textarea when just one exists', () => {
    const { textareas } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'const a = 1;', hasTextarea: true },
          { num: 2, code: 'const b = 2;' },
        ],
      },
    ]);

    const result = findClosestTextarea();
    expect(result).toBe(textareas[0]);
  });

  it('should skip hidden textareas', () => {
    const { textareas } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'const a = 1;', hasTextarea: true },
          { num: 2, code: 'const b = 2;', hasTextarea: true },
        ],
      },
    ]);

    // Make the first textarea hidden
    Object.defineProperty(textareas[0], 'offsetParent', { value: null, configurable: true });
    Object.defineProperty(textareas[0], 'offsetHeight', { value: 0, configurable: true });

    const result = findClosestTextarea();
    expect(result).toBe(textareas[1]);
  });

  it('should return closest textarea when multiple exist and nearElement + lineNumber provided', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'const a = 1;', hasTextarea: true },
          { num: 2, code: 'const b = 2;' },
          { num: 3, code: 'const c = 3;', hasTextarea: true },
        ],
      },
    ]);

    // Select text on line 3 — should get textarea on line 3, not line 1
    const nearLine3 = codeCells.get('a.ts:3')!;
    const result = findClosestTextarea(nearLine3, 3);
    expect(result).toBe(textareas[1]);
  });

  it('should return first match when no nearElement provided', () => {
    const { textareas } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'const a = 1;', hasTextarea: true },
          { num: 10, code: 'const c = 3;', hasTextarea: true },
        ],
      },
    ]);

    const result = findClosestTextarea();
    expect(result).toBe(textareas[0]);
  });

  it('should scope search to the same .file container', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'file-a.ts',
        lines: [
          { num: 1, code: 'const a = 1;', hasTextarea: true },
        ],
      },
      {
        path: 'file-b.ts',
        lines: [
          { num: 1, code: 'const b = 1;', hasTextarea: true },
        ],
      },
    ]);

    // nearElement is in file-b.ts → should get file-b.ts textarea
    const nearFileB = codeCells.get('file-b.ts:1')!;
    const result = findClosestTextarea(nearFileB, 1);
    expect(result).toBe(textareas[1]);
  });

  it('should prefer textarea on the matching line in DOM order', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'line 1', hasTextarea: true },
          { num: 2, code: 'line 2' },
          { num: 3, code: 'line 3' },
          { num: 4, code: 'line 4', hasTextarea: true },
        ],
      },
    ]);

    // Selecting text on line 4 — should get textarea on line 4
    const nearLine4 = codeCells.get('a.ts:4')!;
    const result = findClosestTextarea(nearLine4, 4);
    expect(result).toBe(textareas[1]);
  });

  it('should deduplicate textareas matched by multiple selectors', () => {
    const { textareas } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [{ num: 1, code: 'const a = 1;', hasTextarea: true }],
      },
    ]);

    // Add a second matching class to the same textarea
    textareas[0].classList.add('js-comment-field');

    // Should still return only one result (not duplicate)
    const result = findClosestTextarea();
    expect(result).toBe(textareas[0]);
  });

  it('should return null when selection is far from all textareas', () => {
    const { codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'line 1', hasTextarea: true },
          { num: 2, code: 'line 2' },
          { num: 3, code: 'line 3' },
          { num: 4, code: 'line 4' },
          { num: 5, code: 'line 5' },
          { num: 6, code: 'line 6' },
          { num: 7, code: 'line 7' },
          { num: 8, code: 'line 8' },
          { num: 9, code: 'line 9' },
          { num: 10, code: 'line 10' },
        ],
      },
    ]);

    // Textarea is on line 1, selection is on line 10 — no match
    const nearLine10 = codeCells.get('a.ts:10')!;
    const result = findClosestTextarea(nearLine10, 10);
    expect(result).toBeNull();
  });

  it('should return textarea when selection is on the same line', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 5, code: 'line 5', hasTextarea: true },
          { num: 6, code: 'line 6' },
        ],
      },
    ]);

    // Textarea is on line 5, selection on line 5 — exact match
    const nearLine5 = codeCells.get('a.ts:5')!;
    const result = findClosestTextarea(nearLine5, 5);
    expect(result).toBe(textareas[0]);
  });

  it('should match textarea with ±1 line tolerance for GitHub DOM off-by-one', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 4, code: 'line 4', hasTextarea: true },
          { num: 5, code: 'line 5' },
          { num: 6, code: 'line 6' },
        ],
      },
    ]);

    // Textarea reports line 4, but selection is on line 5 (off-by-one)
    const nearLine5 = codeCells.get('a.ts:5')!;
    const result = findClosestTextarea(nearLine5, 5);
    expect(result).toBe(textareas[0]);
  });

  it('should prefer exact match over ±1 tolerance', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 4, code: 'line 4', hasTextarea: true },
          { num: 5, code: 'line 5', hasTextarea: true },
        ],
      },
    ]);

    // Both textareas are within ±1 of line 5, but textarea on line 5 is exact
    const nearLine5 = codeCells.get('a.ts:5')!;
    const result = findClosestTextarea(nearLine5, 5);
    expect(result).toBe(textareas[1]);
  });
});

// ---------------------------------------------------------------------------
// injectGnMetadata
// ---------------------------------------------------------------------------

describe('injectGnMetadata', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should set textarea value with @gn metadata including line number', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const selInfo = makeSelectionInfo({ exact: 'hello', start: 0, end: 5, lineNumber: 7 });

    injectGnMetadata(textarea, selInfo);

    expect(textarea.value).toContain('@gn:7:0:5');
    // No backticks
    expect(textarea.value).not.toContain('`');
  });

  it('should dispatch input and change events', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const selInfo = makeSelectionInfo();

    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    textarea.addEventListener('input', inputSpy);
    textarea.addEventListener('change', changeSpy);

    injectGnMetadata(textarea, selInfo);

    expect(inputSpy).toHaveBeenCalledTimes(1);
    expect(changeSpy).toHaveBeenCalledTimes(1);
  });

  it('should set cursor position after metadata text', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const selInfo = makeSelectionInfo();

    injectGnMetadata(textarea, selInfo);

    // Cursor should be at the end of the injected value
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });
});

// ---------------------------------------------------------------------------
// isTextareaNearSelection
// ---------------------------------------------------------------------------

describe('isTextareaNearSelection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return true when textarea row directly follows selection row', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'line 1', hasTextarea: true },
          { num: 2, code: 'line 2' },
        ],
      },
    ]);

    const codeCell = codeCells.get('a.ts:1')!;
    expect(isTextareaNearSelection(textareas[0], codeCell)).toBe(true);
  });

  it('should return false when textarea is many rows away', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'line 1', hasTextarea: true },
          { num: 2, code: 'line 2' },
          { num: 3, code: 'line 3' },
          { num: 4, code: 'line 4' },
          { num: 5, code: 'line 5' },
          { num: 6, code: 'line 6' },
          { num: 7, code: 'line 7' },
          { num: 8, code: 'line 8' },
          { num: 9, code: 'line 9' },
          { num: 10, code: 'line 10' },
        ],
      },
    ]);

    const farCell = codeCells.get('a.ts:10')!;
    expect(isTextareaNearSelection(textareas[0], farCell)).toBe(false);
  });

  it('should return true when selection is a few rows before the textarea', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'line 1' },
          { num: 2, code: 'line 2' },
          { num: 3, code: 'line 3', hasTextarea: true },
        ],
      },
    ]);

    // Line 1 is 2 code rows + 0 comment rows before the textarea — within range
    const nearLine1 = codeCells.get('a.ts:1')!;
    expect(isTextareaNearSelection(textareas[0], nearLine1)).toBe(true);
  });

  it('should return true when elements are not in table rows', () => {
    // Fallback: no <tr> → allow injection (can't determine proximity)
    const div1 = document.createElement('div');
    const textarea = document.createElement('textarea');
    document.body.appendChild(div1);
    document.body.appendChild(textarea);

    expect(isTextareaNearSelection(textarea, div1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTextareaLineNumbers
// ---------------------------------------------------------------------------

describe('getTextareaLineNumbers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return the line number from the previous code row', () => {
    const { textareas } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 7, code: 'line 7', hasTextarea: true },
        ],
      },
    ]);

    expect(getTextareaLineNumbers(textareas[0])).toContain(7);
  });

  it('should return empty array when textarea is not in a table row', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    expect(getTextareaLineNumbers(textarea)).toEqual([]);
  });

  it('should return empty array when no line number cell exists', () => {
    const table = document.createElement('table');
    const row1 = document.createElement('tr');
    const cell1 = document.createElement('td');
    cell1.textContent = 'code';
    row1.appendChild(cell1);
    table.appendChild(row1);

    const row2 = document.createElement('tr');
    const cell2 = document.createElement('td');
    const textarea = document.createElement('textarea');
    cell2.appendChild(textarea);
    row2.appendChild(cell2);
    table.appendChild(row2);

    document.body.appendChild(table);

    expect(getTextareaLineNumbers(textarea)).toEqual([]);
  });

  it('should return both line numbers in a split-view row', () => {
    // Build a split-view row with TWO line number cells
    const table = document.createElement('table');

    const codeRow = document.createElement('tr');
    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num';
    leftNum.setAttribute('data-line-number', '4');
    const leftCode = document.createElement('td');
    leftCode.className = 'blob-code-inner';
    leftCode.textContent = 'old code';
    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num';
    rightNum.setAttribute('data-line-number', '5');
    const rightCode = document.createElement('td');
    rightCode.className = 'blob-code-inner';
    rightCode.textContent = 'new code';
    codeRow.append(leftNum, leftCode, rightNum, rightCode);
    table.appendChild(codeRow);

    const commentRow = document.createElement('tr');
    commentRow.className = 'inline-comments';
    const commentCell = document.createElement('td');
    commentCell.colSpan = 4;
    const textarea = document.createElement('textarea');
    textarea.name = 'comment[body]';
    commentCell.appendChild(textarea);
    commentRow.appendChild(commentCell);
    table.appendChild(commentRow);

    document.body.appendChild(table);

    const lineNums = getTextareaLineNumbers(textarea);
    expect(lineNums).toContain(4);
    expect(lineNums).toContain(5);
  });
});
