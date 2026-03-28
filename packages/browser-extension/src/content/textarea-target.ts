import { buildGnComment } from '@gitnotate/core';
import type { TextSelectionInfo } from './selection';

/**
 * CSS selectors for GitHub comment textareas (both old and new UI).
 * Ordered roughly from most specific to least specific.
 */
export const TEXTAREA_SELECTORS = [
  'textarea[name="comment[body]"]',
  'textarea.js-comment-field',
  'textarea.comment-form-textarea',
  'textarea[aria-label*="comment" i]',
  'textarea[aria-label*="review" i]',
  'textarea[placeholder*="comment" i]',
  'textarea[placeholder*="Leave" i]',
  'textarea[placeholder*="write" i]',
  'textarea[placeholder*="reply" i]',
  '.inline-comment-form textarea',
  'markdown-toolbar textarea',
];

/**
 * Find the open comment textarea associated with a specific line.
 *
 * When `nearElement` and `lineNumber` are provided, the search is
 * scoped to the same `.file` container and only a textarea whose
 * inline comment form belongs to a matching line is returned.
 *
 * Returns `null` when no textarea is associated with the given line,
 * preventing metadata from being injected into an unrelated comment.
 */
export function findClosestTextarea(
  nearElement?: HTMLElement,
  lineNumber?: number,
): HTMLTextAreaElement | null {
  // Collect all visible textareas, deduplicating across selectors
  const seen = new Set<HTMLTextAreaElement>();
  const candidates: HTMLTextAreaElement[] = [];

  for (const sel of TEXTAREA_SELECTORS) {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>(sel);
    for (const ta of textareas) {
      if (seen.has(ta)) continue;
      // Must be visible
      if (ta.offsetParent === null && ta.offsetHeight === 0) continue;
      seen.add(ta);
      candidates.push(ta);
    }
  }

  if (candidates.length === 0) return null;
  if (!nearElement) return candidates[0];

  // Scope to the same file container as the selection
  const fileContainer = nearElement.closest('.file, [data-diff-anchor]');
  const pool = fileContainer
    ? candidates.filter((ta) => fileContainer.contains(ta))
    : candidates;

  if (pool.length === 0) return null;

  // Match by line number — most reliable approach
  if (lineNumber !== undefined) {
    for (const ta of pool) {
      const taLines = getTextareaLineNumbers(ta);
      if (taLines.includes(lineNumber)) {
        return ta;
      }
    }
    // No textarea for this line — don't inject into an unrelated one
    return null;
  }

  // Fallback when no line number available: DOM proximity
  const closest =
    pool.length === 1 ? pool[0] : findClosestByDomOrder(pool, nearElement);

  if (!isTextareaNearSelection(closest, nearElement)) {
    return null;
  }

  return closest;
}

/**
 * Determine which diff line numbers a textarea's inline comment form
 * belongs to.  Walks backward from the textarea's `<tr>` to find the
 * nearest code row and returns ALL `data-line-number` values (both
 * sides of a split-view diff).
 */
export function getTextareaLineNumbers(
  textarea: HTMLTextAreaElement,
): number[] {
  const row = textarea.closest('tr');
  if (!row) return [];

  // Walk backward through sibling rows to find a code row with line numbers
  let sibling = row.previousElementSibling;
  for (let i = 0; i < 3 && sibling; i++) {
    const lineCells = sibling.querySelectorAll<HTMLElement>('[data-line-number]');
    const numbers: number[] = [];
    for (const cell of lineCells) {
      const num = Number(cell.getAttribute('data-line-number'));
      if (!isNaN(num)) numbers.push(num);
    }
    if (numbers.length > 0) return numbers;
    sibling = sibling.previousElementSibling;
  }

  return [];
}

/**
 * Among a set of textareas, return the one closest to `nearElement`
 * by DOM tree order.
 *
 * Prefers the first textarea that appears *after* `nearElement` in
 * document order (since GitHub places inline comment forms after the
 * code line). Falls back to the last textarea *before* `nearElement`.
 */
function findClosestByDomOrder(
  textareas: HTMLTextAreaElement[],
  nearElement: HTMLElement,
): HTMLTextAreaElement {
  let closestAfter: HTMLTextAreaElement | null = null;
  let closestBefore: HTMLTextAreaElement | null = null;

  for (const ta of textareas) {
    const position = nearElement.compareDocumentPosition(ta);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      // ta comes after nearElement — keep the first (closest) one
      if (!closestAfter) {
        closestAfter = ta;
      } else {
        const rel = ta.compareDocumentPosition(closestAfter);
        if (rel & Node.DOCUMENT_POSITION_FOLLOWING) {
          // closestAfter comes after ta → ta is closer
          closestAfter = ta;
        }
      }
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      // ta comes before nearElement — keep updating (last = closest)
      closestBefore = ta;
    }
  }

  return closestAfter ?? closestBefore ?? textareas[0];
}

/**
 * Check whether a textarea is in a table row near the selection's row.
 *
 * GitHub places inline comment forms in `<tr>` elements that are
 * direct siblings of the code `<tr>` being commented on.  If the
 * textarea's row is more than `maxRows` siblings away from the
 * selection's row, it belongs to a different comment context and
 * should not receive the metadata.
 */
export function isTextareaNearSelection(
  textarea: HTMLTextAreaElement,
  nearElement: HTMLElement,
  maxRows = 5,
): boolean {
  const selRow = nearElement.closest('tr');
  const taRow = textarea.closest('tr');

  // If either element is not inside a table row, we can't determine
  // proximity — allow injection as a safe fallback.
  if (!selRow || !taRow) return true;
  if (selRow === taRow) return true;

  // Walk forward from selRow
  let current: Element | null = selRow.nextElementSibling;
  for (let i = 0; i < maxRows && current; i++) {
    if (current === taRow) return true;
    current = current.nextElementSibling;
  }

  // Walk backward from selRow (selection might be after the comment form)
  current = selRow.previousElementSibling;
  for (let i = 0; i < maxRows && current; i++) {
    if (current === taRow) return true;
    current = current.previousElementSibling;
  }

  return false;
}

/**
 * Inject `@gn` metadata for a text selection into a GitHub comment
 * textarea, replacing any existing content.
 *
 * Uses the native property setter to work with React-controlled inputs
 * and dispatches `input` + `change` events so GitHub's JS picks up
 * the change.
 */
export function injectGnMetadata(
  textarea: HTMLTextAreaElement,
  selInfo: TextSelectionInfo,
): void {
  const metadata = {
    exact: selInfo.exact,
    start: selInfo.start,
    end: selInfo.end,
  };
  const prefix = buildGnComment(metadata, '');
  const value = prefix + '\n\n';

  // Use native setter to work with React-controlled inputs
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }

  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // Place cursor at the end so user can start typing
  textarea.focus();
  textarea.setSelectionRange(value.length, value.length);
}
