import { parseGnComment, type GnCommentBody } from '@gitnotate/core';

export interface GnReviewComment {
  commentElement: HTMLElement;
  parsed: GnCommentBody;
  filePath: string;
  lineNumber: number;
}

const COMMENT_SELECTORS = [
  '.review-comment',
  '.timeline-comment',
  // New GitHub UI
  '[data-testid*="comment"]',
  '.js-comment',
  '.comment-holder',
] as const;

const COMMENT_BODY_SELECTOR = '.comment-body, .js-comment-body, [data-testid="markdown-body"]';

/**
 * Extract comment text from a `.comment-body` element, preserving line
 * structure and skipping `<blockquote>` elements so the core parser can
 * properly identify the user comment portion.
 *
 * Also checks `innerHTML` for actual HTML comments that the browser hides
 * from `textContent`.
 */
function extractCommentText(body: HTMLElement): string {
  const lines: string[] = [];

  // First, check innerHTML for a real HTML comment (<!-- @gn ... -->)
  // that won't appear in textContent.
  const htmlCommentMatch = body.innerHTML.match(/<!--\s*@gn\s+.*?-->/);
  if (htmlCommentMatch) {
    lines.push(htmlCommentMatch[0]);
  }

  for (const child of body.childNodes) {
    if (child instanceof HTMLElement && child.tagName === 'BLOCKQUOTE') {
      // Emit as a blockquote line so the core parser skips it
      lines.push(`> ${child.textContent ?? ''}`);
      continue;
    }
    const text = child.textContent?.trim();
    if (text) {
      // Don't duplicate the @gn line we already extracted from innerHTML
      if (htmlCommentMatch && text.includes('<!-- @gn')) continue;
      lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Scan the current page for PR review comments that contain @gn metadata.
 * Uses a broad search approach to handle GitHub's evolving DOM structure.
 */
export function scanForGnComments(): GnReviewComment[] {
  const results: GnReviewComment[] = [];

  // Strategy 1: Search all elements that could contain comment text
  // GitHub renders comment bodies in various containers depending on the UI version
  const bodySelectors = [
    '.comment-body',
    '.js-comment-body',
    '[data-testid="markdown-body"]',
    '.markdown-body',
  ];

  const bodies = document.querySelectorAll<HTMLElement>(bodySelectors.join(', '));
  
  for (const body of bodies) {
    const text = extractCommentText(body);
    const parsed = parseGnComment(text);
    if (!parsed) continue;

    // Find the closest meaningful parent for context
    const commentEl = body.closest<HTMLElement>(
      '.review-comment, .timeline-comment, [data-testid*="comment"], .js-comment, .comment-holder'
    ) ?? body.parentElement ?? body;

    const filePath = resolveFilePath(commentEl);
    const lineNumber = resolveLineNumber(commentEl);

    console.log(`[Gitnotate] Found @gn comment: file=${filePath} line=${lineNumber} s=${parsed.metadata.start} e=${parsed.metadata.end}`);

    results.push({
      commentElement: commentEl,
      parsed,
      filePath,
      lineNumber,
    });
  }

  // Strategy 2: If nothing found above, do a raw innerHTML search as fallback
  if (results.length === 0) {
    const allElements = document.querySelectorAll<HTMLElement>('*');
    for (const el of allElements) {
      // Only check leaf-ish elements to avoid duplicates
      if (el.children.length > 10) continue;
      if (!el.innerHTML.includes('@gn')) continue;
      
      const text = extractCommentText(el);
      const parsed = parseGnComment(text);
      if (!parsed) continue;

      const filePath = resolveFilePath(el);
      const lineNumber = resolveLineNumber(el);

      console.log(`[Gitnotate] Found @gn comment (fallback): file=${filePath} line=${lineNumber}`);

      results.push({
        commentElement: el,
        parsed,
        filePath,
        lineNumber,
      });
      break; // Just find the first one to avoid duplicates
    }
  }

  return results;
}

function resolveFilePath(commentEl: HTMLElement): string {
  // Old GitHub UI
  const fileEl = commentEl.closest<HTMLElement>('.file[data-path]');
  if (fileEl) return fileEl.getAttribute('data-path') ?? '';

  // New GitHub UI: walk up to find data-path or data-diff-anchor
  let el: HTMLElement | null = commentEl;
  while (el) {
    const path = el.getAttribute('data-path');
    if (path) return path;
    const anchor = el.getAttribute('data-diff-anchor');
    if (anchor) return anchor;
    el = el.parentElement;
  }

  return '';
}

function resolveLineNumber(commentEl: HTMLElement): number {
  // Direct attribute
  const lineAttr = commentEl.getAttribute('data-line');
  if (lineAttr) return Number(lineAttr);

  // New GitHub UI: look for data-line-number on parent/ancestor elements
  let el: HTMLElement | null = commentEl;
  while (el) {
    const ln = el.getAttribute('data-line-number');
    if (ln) return Number(ln);
    // Check diff-line-key format: "b:5-l:null-r:5"
    const dlk = el.getAttribute('data-diff-line-key');
    if (dlk) {
      const match = dlk.match(/r:(\d+)/);
      if (match) return Number(match[1]);
    }
    el = el.parentElement;
  }

  return 0;
}
