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
] as const;

const COMMENT_BODY_SELECTOR = '.comment-body';

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
 * Returns structured data for each found comment including parsed metadata,
 * the parent file path, and line number.
 */
export function scanForGnComments(): GnReviewComment[] {
  const selector = COMMENT_SELECTORS.join(', ');
  const commentElements = document.querySelectorAll<HTMLElement>(selector);
  const results: GnReviewComment[] = [];

  for (const el of commentElements) {
    const body = el.querySelector<HTMLElement>(COMMENT_BODY_SELECTOR);
    if (!body) continue;

    const text = extractCommentText(body);
    const parsed = parseGnComment(text);
    if (!parsed) continue;

    const filePath = resolveFilePath(el);
    const lineNumber = resolveLineNumber(el);

    results.push({
      commentElement: el,
      parsed,
      filePath,
      lineNumber,
    });
  }

  return results;
}

function resolveFilePath(commentEl: HTMLElement): string {
  // Walk up to find a .file[data-path] ancestor
  const fileEl = commentEl.closest<HTMLElement>('.file[data-path]');
  return fileEl?.getAttribute('data-path') ?? '';
}

function resolveLineNumber(commentEl: HTMLElement): number {
  const lineAttr = commentEl.getAttribute('data-line');
  if (lineAttr) return Number(lineAttr);
  return 0;
}
