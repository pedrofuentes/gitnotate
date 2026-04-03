/**
 * Conversation-view processor for ^gn comments.
 *
 * On the PR Conversation tab, inline review comments appear as timeline
 * items with a self-contained code snippet + comment body. Unlike the
 * full diff view, there is no global `.file[data-path]` wrapper — each
 * thread is independent.
 *
 * This module scans for ^gn metadata, hides it, highlights the
 * referenced character range in the thread's code snippet, and
 * colorizes the thread container.
 */

import { parseGnComment, type GnCommentBody } from '@gitnotate/core';
import { hideGnMetadataInComment } from './metadata-hider';
import { colorizeCommentThread, clearCommentColorIndicators } from './thread-colorizer';
import { clearAllHighlights, HIGHLIGHT_COLOR_COUNT } from './highlighter';
import { debug } from './logger';

export interface ConversationGnComment {
  commentElement: HTMLElement;
  threadContainer: HTMLElement;
  parsed: GnCommentBody;
  lineNumber: number;
}

const GN_TAG_RE = /\^gn:\d+:[LR]:\d+:\d+/g;

// Thread container selectors — the outermost wrapper of a conversation thread
const THREAD_CONTAINER_SELECTORS = [
  '[data-testid="review-thread"]',
  '[data-marker-id]',
  '.js-resolvable-timeline-thread-container',
  '.inline-comment-fragment',
];

/**
 * Scan the conversation page for ^gn comments in rendered comment bodies.
 *
 * Unlike the diff-view scanner, this does NOT require filePath — each
 * result includes a reference to its thread container for scoped
 * code-cell lookup.
 */
export function scanConversationComments(): ConversationGnComment[] {
  const results: ConversationGnComment[] = [];
  const seen = new Set<string>();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? '';
    GN_TAG_RE.lastIndex = 0;

    if (!GN_TAG_RE.test(text)) continue;

    const el = node.parentElement;
    if (!el) continue;

    // Skip text inside textareas / form inputs
    if (el.closest('textarea, input, [contenteditable]')) continue;

    const container = (el.closest('p, div, td, li') ?? el) as HTMLElement;
    const fullText = container.textContent ?? '';

    const parsed = parseGnComment(fullText);
    if (!parsed) continue;

    const { metadata } = parsed;

    // Deduplicate by line:side:start:end
    const key = `${metadata.lineNumber}:${metadata.side}:${metadata.start}:${metadata.end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (metadata.lineNumber <= 0) continue;

    // Find the thread container by walking up
    const threadContainer = findThreadContainer(container);
    if (!threadContainer) continue;

    debug(`[Gitnotate:Conv] Found ^gn:${metadata.lineNumber}:${metadata.side}:${metadata.start}:${metadata.end}`);

    results.push({
      commentElement: container,
      threadContainer,
      parsed,
      lineNumber: metadata.lineNumber,
    });
  }

  return results;
}

/**
 * Find the code cell for a given line number within a thread container's
 * code snippet.
 *
 * Searches only within the thread's DOM — never globally — so multiple
 * threads referencing the same line number don't collide.
 */
export function findConversationCodeCell(
  threadContainer: HTMLElement,
  lineNumber: number,
): HTMLElement | null {
  // New GitHub UI: diff-text-inner within a td with data-line-number
  const diffInner = threadContainer.querySelector<HTMLElement>(
    `td[data-line-number="${lineNumber}"] .diff-text-inner`,
  );
  if (diffInner) return diffInner;

  // Old GitHub UI: blob-num + blob-code-inner in the same row
  const lineNumCell = threadContainer.querySelector<HTMLElement>(
    `td[data-line-number="${lineNumber}"]`,
  );
  if (lineNumCell) {
    const row = lineNumCell.closest('tr');
    if (row) {
      const codeCell =
        row.querySelector<HTMLElement>('.blob-code-inner') ??
        row.querySelector<HTMLElement>('.blob-code') ??
        row.querySelector<HTMLElement>('.diff-text-inner');
      if (codeCell) return codeCell;
    }
  }

  // Fallback: look for any line-number cell and check sibling code cells
  const allLineNums = threadContainer.querySelectorAll<HTMLElement>(
    `[data-line-number="${lineNumber}"]`,
  );
  for (const cell of allLineNums) {
    const row = cell.closest('tr');
    if (!row) continue;
    const codeCell = row.querySelector<HTMLElement>(
      '.diff-text-inner, .blob-code-inner, .blob-code',
    );
    if (codeCell) return codeCell;
  }

  return null;
}

/**
 * Scan conversation comments, hide metadata, highlight code, and colorize.
 */
export function processConversationComments(): void {
  clearAllHighlights();
  clearCommentColorIndicators();

  const comments = scanConversationComments();
  debug(`[Gitnotate:Conv] Found ${comments.length} ^gn comment(s)`);

  const lineColorCounters = new Map<string, number>();

  for (const gc of comments) {
    hideGnMetadataInComment(gc.commentElement);

    const codeCell = findConversationCodeCell(gc.threadContainer, gc.lineNumber);
    if (!codeCell) continue;

    const { metadata } = gc.parsed;
    const result = highlightInCodeCell(codeCell, metadata.start, metadata.end, lineColorCounters);

    if (result) {
      colorizeCommentThread(gc.commentElement, result.colorIndex);
    }
  }
}

// ─── Internal helpers ───────────────────────────────────────────

function findThreadContainer(el: HTMLElement): HTMLElement | null {
  for (const selector of THREAD_CONTAINER_SELECTORS) {
    const container = el.closest<HTMLElement>(selector);
    if (container) return container;
  }
  return null;
}

interface HighlightResult {
  span: HTMLElement;
  colorIndex: number;
}

/**
 * Highlight characters [start, end) within a code cell element.
 * Self-contained — does not depend on global file/line lookups.
 */
function highlightInCodeCell(
  codeCell: HTMLElement,
  start: number,
  end: number,
  lineColorCounters: Map<string, number>,
): HighlightResult | null {
  const fullText = codeCell.textContent ?? '';
  const textLength = fullText.length;

  if (start >= textLength || start < 0 || end <= start) return null;

  const clampedEnd = Math.min(end, textLength);

  const boundary = findTextBoundary(codeCell, start, clampedEnd);
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

  // Assign a distinct color per highlight
  const cellKey = `conv:${codeCell.textContent?.slice(0, 20)}`;
  const colorIndex = (lineColorCounters.get(cellKey) ?? 0) % HIGHLIGHT_COLOR_COUNT;
  lineColorCounters.set(cellKey, colorIndex + 1);
  span.classList.add(`gn-highlight-color-${colorIndex}`);

  try {
    range.surroundContents(span);
  } catch {
    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    } catch {
      return null;
    }
  }

  return { span, colorIndex };
}

interface TextBoundary {
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
}

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
