import { buildGnComment } from '@gitnotate/core';
import { detectGitHubPage } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo, type TextSelectionInfo } from './selection';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import { showFloatButton, hideFloatButton } from './ui/float-button';
import { showCommentForm, hideCommentForm } from './ui/comment-form';
import { submitViaGitHubUI } from './comment-submitter';
import './highlighter.css';
import './ui/float-button.css';
import './ui/comment-form.css';

const pageInfo = detectGitHubPage();
console.log('[Gitnotate] Page detected:', pageInfo);

if (pageInfo.type === 'file-view' && pageInfo.filePath) {
  import('./file-view-handler').then(({ initFileViewComments }) => {
    initFileViewComments(pageInfo);
  });
}

if (pageInfo.type === 'pr-files-changed') {
  console.log('[Gitnotate] PR diff page detected, initializing...');

  // Listen for text selection to show the float button
  document.addEventListener('mouseup', () => {
    // Delay to let the browser finalize the selection
    setTimeout(() => {
      const selInfo = getSelectionInfo();
      if (selInfo) {
        showFloatButton(selInfo, handleFloatButtonClick);
      } else {
        hideFloatButton();
      }
    }, 10);
  });

  // Clear float button when selection is lost
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      hideFloatButton();
    }
  });

  observeDiffContent((diffElements) => {
    console.log('[Gitnotate] Diff elements loaded:', diffElements.length);
    scanAndHighlight();
  });
}

/**
 * Handle the float button click: show the comment form.
 */
function handleFloatButtonClick(selectionInfo: TextSelectionInfo): void {
  hideFloatButton();

  showCommentForm({
    selectionInfo,
    onSubmit: async (userComment: string) => {
      const metadata = {
        exact: selectionInfo.exact,
        start: selectionInfo.start,
        end: selectionInfo.end,
      };
      const commentBody = buildGnComment(metadata, userComment);

      const success = await submitViaGitHubUI({
        filePath: selectionInfo.filePath,
        lineNumber: selectionInfo.lineNumber,
        side: selectionInfo.side,
        commentBody,
      });

      if (!success) {
        throw new Error('Could not open GitHub comment form. Try clicking the "+" on the line manually.');
      }

      // Re-scan after a short delay to pick up the new comment
      setTimeout(scanAndHighlight, 500);
    },
    onCancel: () => {
      hideCommentForm();
    },
  });
}

/**
 * Scan for @gn comments and highlight referenced text ranges.
 */
function scanAndHighlight(): void {
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

    hideGnMetadataInComment(gc.commentElement);
  }
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
