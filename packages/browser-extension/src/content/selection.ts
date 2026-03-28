export interface TextSelectionInfo {
  /** The selected text */
  exact: string;
  /** Character offset from start of the line's text content */
  start: number;
  /** Character offset end (exclusive) */
  end: number;
  /** The diff line number */
  lineNumber: number;
  /** The file path from the diff header */
  filePath: string;
  /** Which side of the diff (for split view) */
  side: 'LEFT' | 'RIGHT';
  /** Reference to the line's DOM element */
  lineElement: HTMLElement;
}

const CODE_CELL_SELECTOR = '.blob-code-inner';
const LINE_NUM_SELECTOR = '.blob-num';
const FILE_SELECTOR = '.file';
const FILE_HEADER_SELECTOR = '.file-header';

/**
 * Find the closest blob-code-inner ancestor (or self) of a node.
 */
function findCodeCell(node: Node): HTMLElement | null {
  const el = node instanceof HTMLElement ? node : node.parentElement;
  return el?.closest<HTMLElement>(CODE_CELL_SELECTOR) ?? null;
}

/**
 * Compute the character offset of a Range boundary relative to the
 * full textContent of `container`.
 */
function textOffset(container: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === node) {
      return pos + offset;
    }
    pos += (current.textContent?.length ?? 0);
  }
  // If node is the container itself (no text nodes), fall back to offset
  return offset;
}

/**
 * Determine LEFT or RIGHT side of a split diff based on the code cell's
 * position within its row. In GitHub's split view, a 4-cell row has
 * columns: leftNum, leftCode, rightNum, rightCode. Cells at index 0-1
 * are LEFT, 2-3 are RIGHT. In unified view there are typically 3 cells
 * (two line-number columns + one code column) — treat that as RIGHT.
 */
function determineSide(codeCell: HTMLElement): 'LEFT' | 'RIGHT' {
  // Check class-based hints first (deletion = LEFT, addition = RIGHT)
  if (codeCell.classList.contains('blob-code-deletion')) return 'LEFT';
  if (codeCell.classList.contains('blob-code-addition')) return 'RIGHT';

  const row = codeCell.closest('tr');
  if (!row) return 'RIGHT';

  const cells = Array.from(row.children);
  const idx = cells.indexOf(codeCell);

  // In split view with 4 cells, first code cell (index 1) is LEFT
  if (cells.length === 4 && idx <= 1) return 'LEFT';

  return 'RIGHT';
}

/**
 * Extract the line number from the nearest `.blob-num` sibling that
 * has a `data-line-number` attribute.
 */
function extractLineNumber(codeCell: HTMLElement): number | null {
  const row = codeCell.closest('tr');
  if (!row) return null;

  // Walk backwards from the code cell to find the closest blob-num with a value
  const cells = Array.from(row.children);
  const idx = cells.indexOf(codeCell);

  for (let i = idx - 1; i >= 0; i--) {
    const attr = cells[i].getAttribute('data-line-number');
    if (attr != null && attr !== '') {
      return Number(attr);
    }
  }

  // Also check all blob-num cells if not found walking backwards
  const numCells = row.querySelectorAll<HTMLElement>(LINE_NUM_SELECTOR);
  for (const nc of numCells) {
    const attr = nc.getAttribute('data-line-number');
    if (attr != null && attr !== '') {
      return Number(attr);
    }
  }

  return null;
}

/**
 * Extract the file path from the closest `.file` or `.file-header` element.
 */
function extractFilePath(codeCell: HTMLElement): string | null {
  const fileEl = codeCell.closest<HTMLElement>(FILE_SELECTOR);
  if (fileEl) {
    const path = fileEl.getAttribute('data-path');
    if (path) return path;

    const header = fileEl.querySelector<HTMLElement>(FILE_HEADER_SELECTOR);
    if (header) {
      const headerPath = header.getAttribute('data-path');
      if (headerPath) return headerPath;

      const link = header.querySelector<HTMLAnchorElement>('a[title]');
      if (link) return link.title;
    }
  }
  return null;
}

/**
 * Inspect the current window selection and, if it represents a valid
 * sub-line selection within a GitHub diff code cell, return the details.
 * Returns `null` when there is no valid selection.
 */
export function getSelectionInfo(): TextSelectionInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  const selectedText = sel.toString();
  if (!selectedText || selectedText.length === 0) return null;

  // Both ends of the selection must be inside the same code cell
  const startCell = findCodeCell(range.startContainer);
  const endCell = findCodeCell(range.endContainer);
  if (!startCell || !endCell || startCell !== endCell) return null;

  const codeCell = startCell;

  // Compute offsets relative to the cell's textContent
  const start = textOffset(codeCell, range.startContainer, range.startOffset);
  const end = textOffset(codeCell, range.endContainer, range.endOffset);

  const lineNumber = extractLineNumber(codeCell);
  if (lineNumber == null) return null;

  const filePath = extractFilePath(codeCell);
  if (!filePath) return null;

  const side = determineSide(codeCell);

  return {
    exact: selectedText,
    start,
    end,
    lineNumber,
    filePath,
    side,
    lineElement: codeCell,
  };
}
