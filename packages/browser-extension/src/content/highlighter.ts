export interface HighlightInfo {
  filePath: string;
  lineNumber: number;
  side: 'L' | 'R';
  start: number;
  end: number;
  commentId: string;
}

export interface HighlightResult {
  span: HTMLElement;
  colorIndex: number;
}

export const HIGHLIGHT_COLOR_COUNT = 6;

export const HIGHLIGHT_COLORS = [
  '#f9a825', // yellow
  '#1e88e5', // blue
  '#8e24aa', // purple
  '#ef6c00', // orange
  '#00897b', // teal
  '#c2185b', // pink
];

// Track how many highlights exist per line to assign distinct colors
const lineColorCounters = new Map<string, number>();

export function resetColorCounters(): void {
  lineColorCounters.clear();
}

/**
 * Escape a string for safe use inside a CSS selector attribute value.
 * Uses CSS.escape when available (browsers); falls back to a manual
 * escape that handles the characters querySelector would choke on.
 */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  // Fallback: escape characters that are special in CSS selectors
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Find the code cell for a given file path + line number.
 * Supports both old (.blob-code-inner) and new (.diff-text-inner) GitHub UI.
 */
function findCodeCell(filePath: string, lineNumber: number, side: 'L' | 'R'): HTMLElement | null {
  const sideClass = side === 'L' ? 'left-side' : 'right-side';
  const diffSide = side === 'L' ? 'left' : 'right';

  // Scope search to the correct file container when filePath is available
  const escapedPath = filePath ? cssEscape(filePath) : '';
  const scopeEl = filePath
    ? document.querySelector<HTMLElement>(
        `.file[data-path="${escapedPath}"], [data-diff-anchor="${escapedPath}"]`,
      )
    : null;
  const scope: ParentNode = scopeEl ?? document;

  // New GitHub UI: use data-diff-side to find the correct side's cell
  const sidedCell = scope.querySelector<HTMLElement>(
    `td[data-diff-side="${diffSide}"][data-line-number="${lineNumber}"] .diff-text-inner`,
  );
  if (sidedCell) return sidedCell;

  // New GitHub UI: side class on the cell
  const sideClassCell = scope.querySelector<HTMLElement>(
    `td.${sideClass}-diff-cell[data-line-number="${lineNumber}"] .diff-text-inner`,
  );
  if (sideClassCell) return sideClassCell;

  // Generic fallback (unified view — no side distinction)
  const genericCell = scope.querySelector<HTMLElement>(
    `td[data-line-number="${lineNumber}"] .diff-text-inner`,
  );
  if (genericCell) return genericCell;

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

  // New GitHub UI fallback: sibling <td>s with side filtering
  const lineNumCells = scope.querySelectorAll<HTMLElement>(
    `[data-line-number="${lineNumber}"]`,
  );
  for (const cell of lineNumCells) {
    // Prefer the cell matching the requested side
    const cellSide = cell.getAttribute('data-diff-side');
    if (cellSide && cellSide !== diffSide) continue;

    const row = cell.closest('tr');
    if (!row) continue;

    // Look for code cell on the correct side
    const codeCells = row.querySelectorAll<HTMLElement>('.diff-text-inner, .blob-code-inner');
    for (const cc of codeCells) {
      const ccTd = cc.closest('td');
      const ccSide = ccTd?.getAttribute('data-diff-side');
      if (!ccSide || ccSide === diffSide) return cc;
    }
  }

  return null;
}

/**
 * Highlight a character range `[start, end)` inside a diff line by wrapping
 * it in a `<span class="gn-highlight">`.
 *
 * Returns the created span, or `null` if the line/range could not be resolved.
 */
export function highlightTextRange(info: HighlightInfo): HighlightResult | null {
  const codeCell = findCodeCell(info.filePath, info.lineNumber, info.side);
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

  // Assign a distinct color per highlight on the same line
  const lineKey = `${info.filePath}:${info.side}:${info.lineNumber}`;
  const colorIndex = (lineColorCounters.get(lineKey) ?? 0) % HIGHLIGHT_COLOR_COUNT;
  lineColorCounters.set(lineKey, colorIndex + 1);
  span.classList.add(`gn-highlight-color-${colorIndex}`);

  try {
    range.surroundContents(span);
  } catch {
    // surroundContents fails when the range crosses element boundaries
    // (e.g., syntax highlighting spans). Fall back to extractContents.
    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    } catch {
      return null;
    }
  }

  // Store metadata on the parent code cell <td> for future use (supports multiple)
  const td = codeCell.closest('td');
  if (td) {
    const entry = `${info.lineNumber}:${info.start}:${info.end}`;
    const existing = td.getAttribute('data-gn-metadata');
    let entries: string[];
    try {
      entries = existing ? JSON.parse(existing) : [];
    } catch {
      entries = [];
    }
    if (!entries.includes(entry)) {
      entries.push(entry);
    }
    td.setAttribute('data-gn-metadata', JSON.stringify(entries));
  }

  return { span, colorIndex };
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
  resetColorCounters();
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

