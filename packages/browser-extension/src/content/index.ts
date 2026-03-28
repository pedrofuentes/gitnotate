import { detectGitHubPage } from './detector';
import { observeDiffContent } from './diff-observer';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import './highlighter.css';

const pageInfo = detectGitHubPage();
console.log('[Gitnotate] Page detected:', pageInfo);

if (pageInfo.type === 'pr-files-changed') {
  console.log('[Gitnotate] PR diff page detected, initializing...');
  observeDiffContent((diffElements) => {
    console.log('[Gitnotate] Diff elements loaded:', diffElements.length);

    // Scan for @gn-enhanced review comments and highlight referenced text
    clearAllHighlights();
    const gnComments = scanForGnComments();
    console.log(`[Gitnotate] Found ${gnComments.length} @gn comment(s)`);

    for (const gc of gnComments) {
      const { metadata } = gc.parsed;
      const commentId = gc.commentElement.id || `gn-${gc.filePath}-${gc.lineNumber}`;

      highlightTextRange({
        filePath: gc.filePath,
        lineNumber: gc.lineNumber,
        start: metadata.start,
        end: metadata.end,
        commentId,
      });

      // Hide the @gn metadata line and blockquote fallback from the comment display
      hideGnMetadataInComment(gc.commentElement);
    }
  });
}

/**
 * Hide the `<!-- @gn ... -->` metadata line and the blockquote fallback
 * from a review comment's visible body, since the extension handles
 * highlighting directly.
 */
function hideGnMetadataInComment(commentEl: HTMLElement): void {
  const body = commentEl.querySelector('.comment-body');
  if (!body) return;

  for (const child of Array.from(body.children)) {
    // Hide <p> containing the @gn metadata (escaped HTML comment)
    if (child.tagName === 'P' && child.textContent?.includes('<!-- @gn')) {
      (child as HTMLElement).style.display = 'none';
      continue;
    }
    // Hide the blockquote fallback (📌 "..." (chars ...))
    if (child.tagName === 'BLOCKQUOTE' && child.textContent?.includes('📌')) {
      (child as HTMLElement).style.display = 'none';
    }
  }
}
