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

  // Check innerHTML for HTML comments (<!-- @gn ... -->) that textContent hides
  const htmlCommentMatch = body.innerHTML.match(/<!--\s*@gn\s+.*?-->/);
  if (htmlCommentMatch) {
    lines.push(htmlCommentMatch[0]);
  }

  // Get the full text content — this will include rendered `gn:start:end` code spans
  const fullText = body.textContent?.trim() ?? '';
  if (fullText) {
    lines.push(fullText);
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

  // Strategy 2: Search for rendered `@gn:` code tags (new format)
  if (results.length === 0) {
    const codeElements = document.querySelectorAll<HTMLElement>('code');
    for (const code of codeElements) {
      const text = code.textContent ?? '';
      if (!text.startsWith('@gn:')) continue;

      // Build the full comment text from the code's parent paragraph/container
      const container = code.closest('p, div, td') ?? code.parentElement;
      if (!container) continue;

      const fullText = container.textContent ?? '';
      const parsed = parseGnComment(fullText);
      if (!parsed) continue;

      // Walk up to find file path and line number
      const filePath = resolveFilePath(container);
      const lineNumber = resolveLineNumber(container);

      console.log(`[Gitnotate] Found @gn tag in code element: file=${filePath} line=${lineNumber}`);

      results.push({
        commentElement: container,
        parsed,
        filePath,
        lineNumber,
      });
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
