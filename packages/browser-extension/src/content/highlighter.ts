export interface HighlightInfo {
  filePath: string;
  lineNumber: number;
  start: number;
  end: number;
  commentId: string;
}

/**
 * Find the code cell for a given file path + line number.
 * Supports both old (.blob-code-inner) and new (.diff-text-inner) GitHub UI.
 */
function findCodeCell(filePath: string, lineNumber: number): HTMLElement | null {
  // Scope search to the correct file container when filePath is available
  const scopeEl = filePath
    ? document.querySelector<HTMLElement>(
        `.file[data-path="${filePath}"], [data-diff-anchor="${filePath}"]`,
      )
    : null;
  const scope: ParentNode = scopeEl ?? document;

  // New GitHub UI: td[data-line-number] contains .diff-text-inner
  const newCell = scope.querySelector<HTMLElement>(
    `td[data-line-number="${lineNumber}"] .diff-text-inner`,
  );
  if (newCell) return newCell;

  // Also try right-side cells specifically
  const rightCell = scope.querySelector<HTMLElement>(
    `td.right-side-diff-cell[data-line-number="${lineNumber}"] .diff-text-inner`,
  );
  if (rightCell) return rightCell;

  // Old GitHub UI fallback: blob-num + blob-code-inner in the same row
  const lineNumCell = scope.querySelector<HTMLElement>(
    `td.blob-num[data-line-number="${lineNumber}"]`,
  );
  if (lineNumCell) {
    const row = lineNumCell.closest('tr');
    if (row) {
      const cell = row.querySelector<HTMLElement>('.blob-code-inner') ?? row.querySelector<HTMLElement>('.blob-code');
      if (cell) return cell;
    }
  }

  // New GitHub UI fallback: line number and code cell are SIBLING <td>s
  const lineNumCells = scope.querySelectorAll<HTMLElement>(
    `[data-line-number="${lineNumber}"]`,
  );
  for (const cell of lineNumCells) {
    const row = cell.closest('tr');
    if (!row) continue;
    const codeCell =
      row.querySelector<HTMLElement>('.diff-text-inner') ??
      row.querySelector<HTMLElement>('.blob-code-inner');
    if (codeCell) return codeCell;
  }

  return null;
}

/**
 * Highlight a character range `[start, end)` inside a diff line by wrapping
 * it in a `<span class="gn-highlight">`.
 *
 * Returns the created span, or `null` if the line/range could not be resolved.
 */
export function highlightTextRange(info: HighlightInfo): HTMLElement | null {
  const codeCell = findCodeCell(info.filePath, info.lineNumber);
  if (!codeCell) return null;

  const fullText = codeCell.textContent ?? '';
  const textLength = fullText.length;

  // Validate offsets
  if (info.start >= textLength || info.start < 0 || info.end <= info.start) {
    return null;
  }

  const clampedEnd = Math.min(info.end, textLength);

  // Walk text nodes to find the ones spanning [start, end)
  const boundary = findTextBoundary(codeCell, info.start, clampedEnd);
  if (!boundary) return null;

  const range = document.createRange();
  try {
    range.setStart(boundary.startNode, boundary.startOffset);
    range.setEnd(boundary.endNode, boundary.endOffset);
  } catch {
    return null;
  }

  const span = document.createElement('span');
  span.className = 'gn-highlight';
  span.setAttribute('data-gn-comment-id', info.commentId);
  span.setAttribute('data-gn-line', String(info.lineNumber));
  span.setAttribute('data-gn-start', String(info.start));
  span.setAttribute('data-gn-end', String(info.end));

  try {
    range.surroundContents(span);
  } catch {
    return null;
  }

  // Store metadata on the parent code cell <td> for future use (supports multiple)
  const td = codeCell.closest('td');
  if (td) {
    const entry = `${info.lineNumber}:${info.start}:${info.end}`;
    const existing = td.getAttribute('data-gn-metadata');
    const entries: string[] = existing ? JSON.parse(existing) : [];
    if (!entries.includes(entry)) {
      entries.push(entry);
    }
    td.setAttribute('data-gn-metadata', JSON.stringify(entries));
  }

  return span;
}

interface TextBoundary {
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
}

/**
 * Walk text nodes within `el` and find the nodes + local offsets for
 * the character range `[start, end)` in the overall textContent.
 */
function findTextBoundary(el: HTMLElement, start: number, end: number): TextBoundary | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let cumulative = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const nodeLen = (node.textContent ?? '').length;
    const nodeStart = cumulative;
    const nodeEnd = cumulative + nodeLen;

    if (!startNode && start < nodeEnd) {
      startNode = node;
      startOffset = start - nodeStart;
    }

    if (startNode && end <= nodeEnd) {
      endNode = node;
      endOffset = end - nodeStart;
      break;
    }

    cumulative = nodeEnd;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) return null;
  return { startNode, startOffset, endNode, endOffset };
}

/**
 * Remove all `.gn-highlight` spans from the page, restoring original text.
 */
export function clearAllHighlights(): void {
  const highlights = document.querySelectorAll<HTMLElement>('.gn-highlight');
  for (const span of highlights) {
    unwrapSpan(span);
  }
}

/**
 * Remove highlights for a specific comment ID.
 */
export function clearHighlight(commentId: string): void {
  const spans = document.querySelectorAll<HTMLElement>(
    `.gn-highlight[data-gn-comment-id="${commentId.replace(/"/g, '\\"')}"]`,
  );
  for (const span of spans) {
    unwrapSpan(span);
  }
}

/**
 * Replace a span with its text content, merging adjacent text nodes.
 */
function unwrapSpan(span: HTMLElement): void {
  const parent = span.parentNode;
  if (!parent) return;

  while (span.firstChild) {
    parent.insertBefore(span.firstChild, span);
  }
  parent.removeChild(span);
  parent.normalize();
}

