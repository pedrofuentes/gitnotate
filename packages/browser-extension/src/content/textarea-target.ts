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
 * Find the open comment textarea closest to the given DOM element.
 *
 * When `nearElement` is provided and multiple visible textareas exist,
 * the search is scoped to the same `.file` container and the closest
 * textarea by DOM order is returned.
 *
 * Falls back to the first visible textarea when no proximity hint is
 * given or when scoping does not narrow the candidates.
 */
export function findClosestTextarea(
  nearElement?: HTMLElement,
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
  if (candidates.length === 1 || !nearElement) return candidates[0];

  // Scope to the same file container as the selection
  const fileContainer = nearElement.closest('.file, [data-diff-anchor]');
  if (fileContainer) {
    const inFile = candidates.filter((ta) => fileContainer.contains(ta));
    if (inFile.length === 1) return inFile[0];
    if (inFile.length > 1) {
      return findClosestByDomOrder(inFile, nearElement);
    }
  }

  return candidates[0];
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
