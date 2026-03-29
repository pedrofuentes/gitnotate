import { parseGnComment, type GnCommentBody } from '@gitnotate/core';

export interface GnReviewComment {
  commentElement: HTMLElement;
  parsed: GnCommentBody;
  filePath: string;
  lineNumber: number;
}

// 3-field format: ^gn:line:start:end
const GN_TAG_RE = /\^gn:\d+:\d+:\d+/g;

/**
 * Scan the page for @gn tags using a single regex pass,
 * then resolve DOM context for each match.
 */
export function scanForGnComments(): GnReviewComment[] {
  const results: GnReviewComment[] = [];
  const seen = new Set<string>();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? '';
    GN_TAG_RE.lastIndex = 0;

    if (!GN_TAG_RE.test(text)) continue;

    const el = node.parentElement;
    if (!el) continue;

    const container = el.closest('p, div, td, li') ?? el;
    const fullText = container.textContent ?? '';

    const parsed = parseGnComment(fullText);
    if (!parsed) continue;

    // Use lineNumber from metadata (reliable) + filePath from DOM
    const lineNumber = parsed.metadata.lineNumber;
    const filePath = resolveFilePath(container);

    const key = `${lineNumber}:${parsed.metadata.start}:${parsed.metadata.end}`;
    if (seen.has(key)) continue;

    if (!filePath || lineNumber <= 0) continue;
    seen.add(key);

    console.log(`[Gitnotate] Found ^gn:${lineNumber}:${parsed.metadata.start}:${parsed.metadata.end} file=${filePath}`);

    results.push({
      commentElement: container,
      parsed,
      filePath,
      lineNumber,
    });
  }

  return results;
}

function resolveFilePath(el: HTMLElement): string {
  let current: HTMLElement | null = el;
  while (current) {
    const path = current.getAttribute('data-path');
    if (path) return path;
    const anchor = current.getAttribute('data-diff-anchor');
    if (anchor) return anchor;
    current = current.parentElement;
  }
  return '';
}
