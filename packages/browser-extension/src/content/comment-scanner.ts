import { parseGnComment, type GnCommentBody } from '@gitnotate/core';

export interface GnReviewComment {
  commentElement: HTMLElement;
  parsed: GnCommentBody;
  filePath: string;
  lineNumber: number;
}

const GN_TAG_RE = /@gn:\d+:\d+/g;

/**
 * Scan the page for @gn tags using a single regex pass,
 * then resolve DOM context for each match.
 */
export function scanForGnComments(): GnReviewComment[] {
  const results: GnReviewComment[] = [];
  const seen = new Set<string>();

  // Single regex scan across all text nodes via TreeWalker
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? '';
    GN_TAG_RE.lastIndex = 0;

    if (!GN_TAG_RE.test(text)) continue;

    // Found a text node containing @gn:start:end
    // Get the parent element for context
    const el = node.parentElement;
    if (!el) continue;

    // Get the full comment text (parent paragraph or container)
    const container = el.closest('p, div, td, li') ?? el;
    const fullText = container.textContent ?? '';

    const parsed = parseGnComment(fullText);
    if (!parsed) continue;

    // Deduplicate by start:end
    const key = `${parsed.metadata.start}:${parsed.metadata.end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const filePath = resolveFilePath(container);
    const lineNumber = resolveLineNumber(container);

    console.log(`[Gitnotate] Found @gn:${parsed.metadata.start}:${parsed.metadata.end} file=${filePath} line=${lineNumber}`);

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

function resolveLineNumber(el: HTMLElement): number {
  let current: HTMLElement | null = el;
  while (current) {
    const ln = current.getAttribute('data-line-number');
    if (ln) return Number(ln);

    // Check diff-line-key format: "b:5-l:null-r:5"
    const dlk = current.getAttribute('data-diff-line-key');
    if (dlk) {
      const match = dlk.match(/r:(\d+)/);
      if (match) return Number(match[1]);
    }

    current = current.parentElement;
  }
  return 0;
}
