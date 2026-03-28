import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findClosestTextarea,
  injectGnMetadata,
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

  it('should return closest textarea when multiple exist and nearElement is provided', () => {
    const { textareas, codeCells } = buildDiffDom([
      {
        path: 'a.ts',
        lines: [
          { num: 1, code: 'const a = 1;', hasTextarea: true },
          { num: 5, code: 'const b = 2;' },
          { num: 10, code: 'const c = 3;', hasTextarea: true },
        ],
      },
    ]);

    // Select text near line 10 — should get textarea on line 10, not line 1
    const nearLine10 = codeCells.get('a.ts:10')!;
    const result = findClosestTextarea(nearLine10);
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
    const result = findClosestTextarea(nearFileB);
    expect(result).toBe(textareas[1]);
  });

  it('should prefer textarea after nearElement in DOM order', () => {
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

    // Selecting text on line 3 — textarea on line 4 (after) is closer
    const nearLine3 = codeCells.get('a.ts:3')!;
    const result = findClosestTextarea(nearLine3);
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
});

// ---------------------------------------------------------------------------
// injectGnMetadata
// ---------------------------------------------------------------------------

describe('injectGnMetadata', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should set textarea value with @gn metadata prefix', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const selInfo = makeSelectionInfo({ exact: 'hello', start: 0, end: 5 });

    injectGnMetadata(textarea, selInfo);

    expect(textarea.value).toContain('@gn');
    expect(textarea.value).toContain('0:5');
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
