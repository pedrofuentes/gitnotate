import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSelectionInfo, type TextSelectionInfo } from '../../src/content/selection';

/**
 * Helper: build a GitHub-like diff table structure.
 *
 *   <div class="file" data-path="{filePath}">
 *     <div class="file-header" data-path="{filePath}"></div>
 *     <table class="diff-table">
 *       <tr>
 *         <td class="blob-num" data-line-number="{lineNumber}"></td>
 *         <td class="blob-code blob-code-inner">{lineText}</td>
 *       </tr>
 *     </table>
 *   </div>
 */
function buildDiffDOM(opts: {
  filePath?: string;
  lineNumber?: number;
  lineText?: string;
  side?: 'LEFT' | 'RIGHT';
} = {}): { codeCell: HTMLElement; numCell: HTMLElement; file: HTMLElement } {
  const {
    filePath = 'docs/proposal.md',
    lineNumber = 3,
    lineText = 'In Q3, our revenue growth exceeded expectations by a significant margin.',
    side = 'RIGHT',
  } = opts;

  const file = document.createElement('div');
  file.className = 'file';
  file.setAttribute('data-path', filePath);

  const header = document.createElement('div');
  header.className = 'file-header';
  header.setAttribute('data-path', filePath);
  file.appendChild(header);

  const table = document.createElement('table');
  table.className = 'diff-table';
  file.appendChild(table);

  const tr = document.createElement('tr');
  table.appendChild(tr);

  if (side === 'RIGHT') {
    // For split view: left num, left code, right num, right code
    const emptyNum = document.createElement('td');
    emptyNum.className = 'blob-num blob-num-deletion';
    tr.appendChild(emptyNum);

    const emptyCode = document.createElement('td');
    emptyCode.className = 'blob-code blob-code-inner blob-code-deletion';
    emptyCode.textContent = '';
    tr.appendChild(emptyCode);
  }

  const numCell = document.createElement('td');
  numCell.className = 'blob-num';
  numCell.setAttribute('data-line-number', String(lineNumber));
  tr.appendChild(numCell);

  const codeCell = document.createElement('td');
  codeCell.className = 'blob-code blob-code-inner';
  codeCell.textContent = lineText;
  tr.appendChild(codeCell);

  document.body.appendChild(file);

  return { codeCell, numCell, file };
}

/**
 * Simulate a text selection within a single element at the given offsets.
 */
function mockSelection(
  node: Node,
  startOffset: number,
  endOffset: number,
): void {
  const textNode = node.firstChild;
  if (!textNode) throw new Error('Node has no text child');

  const range = document.createRange();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);

  // jsdom doesn't have getBoundingClientRect on Range; mock it
  range.getBoundingClientRect = () => ({
    x: 100,
    y: 200,
    width: 80,
    height: 16,
    top: 200,
    right: 180,
    bottom: 216,
    left: 100,
    toJSON: () => ({}),
  });

  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Clear any active selection. */
function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

describe('getSelectionInfo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearSelection();
  });

  it('should return null when no text is selected', () => {
    buildDiffDOM();
    expect(getSelectionInfo()).toBeNull();
  });

  it('should return selection info when text is selected within a diff line', () => {
    const { codeCell } = buildDiffDOM({ lineText: 'Hello world of code' });
    // Select "world" (offset 6..11)
    mockSelection(codeCell, 6, 11);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.exact).toBe('world');
  });

  it('should calculate correct character offsets', () => {
    const lineText = 'In Q3, our revenue growth exceeded expectations by a significant margin.';
    const { codeCell } = buildDiffDOM({ lineText });
    // Select "revenue growth" (offset 11..25)
    mockSelection(codeCell, 11, 25);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.start).toBe(11);
    expect(info!.end).toBe(25);
    expect(info!.exact).toBe('revenue growth');
  });

  it('should extract line number from adjacent element', () => {
    const { codeCell } = buildDiffDOM({ lineNumber: 42, lineText: 'some code here' });
    mockSelection(codeCell, 0, 4);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.lineNumber).toBe(42);
  });

  it('should extract file path from file header', () => {
    const { codeCell } = buildDiffDOM({
      filePath: 'src/utils/helpers.ts',
      lineText: 'export function helper() {}',
    });
    mockSelection(codeCell, 0, 6);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.filePath).toBe('src/utils/helpers.ts');
  });

  it('should return null when selection spans multiple lines', () => {
    // Build two diff lines
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'test.ts');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'test.ts');
    file.appendChild(header);

    const table = document.createElement('table');
    table.className = 'diff-table';
    file.appendChild(table);

    const tr1 = document.createElement('tr');
    const num1 = document.createElement('td');
    num1.className = 'blob-num';
    num1.setAttribute('data-line-number', '1');
    const code1 = document.createElement('td');
    code1.className = 'blob-code blob-code-inner';
    code1.textContent = 'Line one text';
    tr1.appendChild(num1);
    tr1.appendChild(code1);
    table.appendChild(tr1);

    const tr2 = document.createElement('tr');
    const num2 = document.createElement('td');
    num2.className = 'blob-num';
    num2.setAttribute('data-line-number', '2');
    const code2 = document.createElement('td');
    code2.className = 'blob-code blob-code-inner';
    code2.textContent = 'Line two text';
    tr2.appendChild(num2);
    tr2.appendChild(code2);
    table.appendChild(tr2);

    document.body.appendChild(file);

    // Select across two cells
    const range = document.createRange();
    range.setStart(code1.firstChild!, 5);
    range.setEnd(code2.firstChild!, 4);

    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    expect(getSelectionInfo()).toBeNull();
  });

  it('should return null when selection is outside diff area', () => {
    const p = document.createElement('p');
    p.textContent = 'This is not in a diff';
    document.body.appendChild(p);

    mockSelection(p, 0, 4);

    expect(getSelectionInfo()).toBeNull();
  });

  it('should determine LEFT side correctly', () => {
    // Build a unified/left-side only row
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'readme.md');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'readme.md');
    file.appendChild(header);

    const table = document.createElement('table');
    table.className = 'diff-table';
    file.appendChild(table);

    const tr = document.createElement('tr');
    table.appendChild(tr);

    // Left num + code (deletion side)
    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num blob-num-deletion';
    leftNum.setAttribute('data-line-number', '10');
    tr.appendChild(leftNum);

    const leftCode = document.createElement('td');
    leftCode.className = 'blob-code blob-code-inner blob-code-deletion';
    leftCode.textContent = 'old code here';
    tr.appendChild(leftCode);

    // Right num + code (empty addition side)
    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num blob-num-addition';
    tr.appendChild(rightNum);

    const rightCode = document.createElement('td');
    rightCode.className = 'blob-code blob-code-inner blob-code-addition';
    rightCode.textContent = '';
    tr.appendChild(rightCode);

    document.body.appendChild(file);

    mockSelection(leftCode, 0, 3);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('LEFT');
  });

  it('should determine RIGHT side correctly', () => {
    const { codeCell } = buildDiffDOM({ side: 'RIGHT', lineText: 'new code' });
    mockSelection(codeCell, 0, 3);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('RIGHT');
  });

  it('should return lineElement pointing to the code cell', () => {
    const { codeCell } = buildDiffDOM({ lineText: 'test content' });
    mockSelection(codeCell, 0, 4);

    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.lineElement).toBe(codeCell);
  });

  it('should return null when selection is collapsed (cursor only)', () => {
    const { codeCell } = buildDiffDOM({ lineText: 'Hello' });
    // Create a collapsed selection (start == end)
    const textNode = codeCell.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.setEnd(textNode, 2);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    expect(getSelectionInfo()).toBeNull();
  });

  // --- determineSide: data-diff-side attribute ---

  it('should determine LEFT side from data-diff-side="left" on parent td', () => {
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'side-test.ts');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'side-test.ts');
    file.appendChild(header);

    const table = document.createElement('table');
    file.appendChild(table);
    const tr = document.createElement('tr');
    table.appendChild(tr);

    // Left num
    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num';
    leftNum.setAttribute('data-line-number', '5');
    tr.appendChild(leftNum);

    // Left code: no blob-code-deletion class, but td has data-diff-side="left"
    const leftTd = document.createElement('td');
    leftTd.setAttribute('data-diff-side', 'left');
    const leftCode = document.createElement('div');
    leftCode.className = 'blob-code-inner';
    leftCode.textContent = 'left side text';
    leftTd.appendChild(leftCode);
    tr.appendChild(leftTd);

    // Right num
    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num';
    rightNum.setAttribute('data-line-number', '5');
    tr.appendChild(rightNum);

    // Right code
    const rightTd = document.createElement('td');
    rightTd.setAttribute('data-diff-side', 'right');
    const rightCode = document.createElement('div');
    rightCode.className = 'blob-code-inner';
    rightCode.textContent = 'right side text';
    rightTd.appendChild(rightCode);
    tr.appendChild(rightTd);

    document.body.appendChild(file);

    mockSelection(leftCode, 0, 4);
    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('LEFT');
  });

  it('should determine RIGHT side from data-diff-side="right" on parent td', () => {
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'side-test2.ts');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'side-test2.ts');
    file.appendChild(header);

    const table = document.createElement('table');
    file.appendChild(table);
    const tr = document.createElement('tr');
    table.appendChild(tr);

    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num';
    leftNum.setAttribute('data-line-number', '7');
    tr.appendChild(leftNum);

    const leftTd = document.createElement('td');
    leftTd.setAttribute('data-diff-side', 'left');
    const leftCode = document.createElement('div');
    leftCode.className = 'blob-code-inner';
    leftCode.textContent = 'left content';
    leftTd.appendChild(leftCode);
    tr.appendChild(leftTd);

    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num';
    rightNum.setAttribute('data-line-number', '7');
    tr.appendChild(rightNum);

    const rightTd = document.createElement('td');
    rightTd.setAttribute('data-diff-side', 'right');
    const rightCode = document.createElement('div');
    rightCode.className = 'blob-code-inner';
    rightCode.textContent = 'right content';
    rightTd.appendChild(rightCode);
    tr.appendChild(rightTd);

    document.body.appendChild(file);

    mockSelection(rightCode, 0, 5);
    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('RIGHT');
  });

  // --- determineSide: left-side / right-side class checks ---

  it('should determine LEFT side from left-side class on parent td', () => {
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'class-test.ts');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'class-test.ts');
    file.appendChild(header);

    const table = document.createElement('table');
    file.appendChild(table);
    const tr = document.createElement('tr');
    table.appendChild(tr);

    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num';
    leftNum.setAttribute('data-line-number', '15');
    tr.appendChild(leftNum);

    const leftTd = document.createElement('td');
    leftTd.className = 'left-side';
    const leftCode = document.createElement('div');
    leftCode.className = 'blob-code-inner';
    leftCode.textContent = 'left class code';
    leftTd.appendChild(leftCode);
    tr.appendChild(leftTd);

    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num';
    rightNum.setAttribute('data-line-number', '15');
    tr.appendChild(rightNum);

    const rightTd = document.createElement('td');
    rightTd.className = 'right-side';
    const rightCode = document.createElement('div');
    rightCode.className = 'blob-code-inner';
    rightCode.textContent = 'right class code';
    rightTd.appendChild(rightCode);
    tr.appendChild(rightTd);

    document.body.appendChild(file);

    mockSelection(leftCode, 0, 4);
    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('LEFT');
  });

  it('should determine RIGHT side from right-side class on parent td', () => {
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'class-test2.ts');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'class-test2.ts');
    file.appendChild(header);

    const table = document.createElement('table');
    file.appendChild(table);
    const tr = document.createElement('tr');
    table.appendChild(tr);

    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num';
    leftNum.setAttribute('data-line-number', '20');
    tr.appendChild(leftNum);

    const leftTd = document.createElement('td');
    leftTd.className = 'left-side';
    const leftCode = document.createElement('div');
    leftCode.className = 'blob-code-inner';
    leftCode.textContent = 'old content';
    leftTd.appendChild(leftCode);
    tr.appendChild(leftTd);

    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num';
    rightNum.setAttribute('data-line-number', '20');
    tr.appendChild(rightNum);

    const rightTd = document.createElement('td');
    rightTd.className = 'right-side';
    const rightCode = document.createElement('div');
    rightCode.className = 'blob-code-inner';
    rightCode.textContent = 'new content';
    rightTd.appendChild(rightCode);
    tr.appendChild(rightTd);

    document.body.appendChild(file);

    mockSelection(rightCode, 0, 3);
    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('RIGHT');
  });

  it('should determine LEFT side from left-side-diff-cell class on parent td', () => {
    const file = document.createElement('div');
    file.className = 'file';
    file.setAttribute('data-path', 'diff-cell-test.ts');

    const header = document.createElement('div');
    header.className = 'file-header';
    header.setAttribute('data-path', 'diff-cell-test.ts');
    file.appendChild(header);

    const table = document.createElement('table');
    file.appendChild(table);
    const tr = document.createElement('tr');
    table.appendChild(tr);

    const leftNum = document.createElement('td');
    leftNum.className = 'blob-num';
    leftNum.setAttribute('data-line-number', '8');
    tr.appendChild(leftNum);

    const leftTd = document.createElement('td');
    leftTd.className = 'left-side-diff-cell';
    const leftCode = document.createElement('div');
    leftCode.className = 'blob-code-inner';
    leftCode.textContent = 'diff cell left';
    leftTd.appendChild(leftCode);
    tr.appendChild(leftTd);

    const rightNum = document.createElement('td');
    rightNum.className = 'blob-num';
    rightNum.setAttribute('data-line-number', '8');
    tr.appendChild(rightNum);

    const rightTd = document.createElement('td');
    rightTd.className = 'right-side-diff-cell';
    const rightCode = document.createElement('div');
    rightCode.className = 'blob-code-inner';
    rightCode.textContent = 'diff cell right';
    rightTd.appendChild(rightCode);
    tr.appendChild(rightTd);

    document.body.appendChild(file);

    mockSelection(leftCode, 0, 4);
    const info = getSelectionInfo();
    expect(info).not.toBeNull();
    expect(info!.side).toBe('LEFT');
  });
});
