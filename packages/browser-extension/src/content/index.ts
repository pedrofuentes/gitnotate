import { buildGnComment } from '@gitnotate/core';
import { detectGitHubPage, type GitHubPageInfo } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo, type TextSelectionInfo } from './selection';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import { showFloatButton, hideFloatButton } from './ui/float-button';
import { showCommentForm, hideCommentForm } from './ui/comment-form';
import { showOptInBanner, hideOptInBanner } from './ui/optin-banner';
import { submitViaGitHubUI } from './comment-submitter';
import { isRepoEnabled, enableRepo } from '../storage/repo-settings';
import { initFileViewComments } from './file-view-handler';
import './highlighter.css';
import './ui/float-button.css';
import './ui/comment-form.css';
import './ui/optin-banner.css';

let currentPageInfo: GitHubPageInfo = detectGitHubPage();
let activated = false;

console.log('[Gitnotate] Content script loaded at:', window.location.href);

async function init(): Promise<void> {
  currentPageInfo = detectGitHubPage();
  activated = false;
  console.log('[Gitnotate] init() called');
  console.log('[Gitnotate] URL:', window.location.pathname);
  console.log('[Gitnotate] Page detected:', JSON.stringify(currentPageInfo));

  if (currentPageInfo.type === 'other' || !currentPageInfo.owner || !currentPageInfo.repo) {
    console.log('[Gitnotate] Skipping — page type is "other" or missing owner/repo');
    return;
  }

  console.log('[Gitnotate] Checking if repo is enabled:', `${currentPageInfo.owner}/${currentPageInfo.repo}`);
  const enabled = await isRepoEnabled(currentPageInfo.owner, currentPageInfo.repo);
  console.log('[Gitnotate] Repo enabled:', enabled);

  if (!enabled) {
    console.log('[Gitnotate] Repo not enabled, page type:', currentPageInfo.type);
    if (currentPageInfo.type === 'pr-files-changed' || currentPageInfo.type === 'pr-conversation') {
      console.log('[Gitnotate] Showing opt-in banner');
      const pageRef = currentPageInfo;
      showOptInBanner(
        pageRef.owner,
        pageRef.repo,
        async () => {
          await enableRepo(pageRef.owner, pageRef.repo);
          console.log(`[Gitnotate] Enabled for ${pageRef.owner}/${pageRef.repo}`);
          activateFeatures(pageRef);
        },
        () => {
          console.log('[Gitnotate] User dismissed opt-in');
        },
      );
    } else {
      console.log('[Gitnotate] Not a PR page, skipping opt-in banner');
    }
    return;
  }

  activateFeatures(currentPageInfo);
}

function activateFeatures(pageInfo: GitHubPageInfo): void {
  if (activated) return;
  activated = true;

  hideOptInBanner();

  if (pageInfo.type === 'file-view' && pageInfo.filePath) {
    initFileViewComments(pageInfo);
  }

  if (pageInfo.type === 'pr-files-changed') {
    console.log('[Gitnotate] PR diff page detected, initializing...');

    document.addEventListener('mouseup', () => {
      setTimeout(() => {
        const selInfo = getSelectionInfo();
        if (selInfo) {
          showFloatButton(selInfo, handleFloatButtonClick);
        } else {
          hideFloatButton();
        }
      }, 10);
    });

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
}

// Initial run
console.log('[Gitnotate] Running initial init()');
init().catch(console.error);

// Re-run on GitHub's SPA navigation (turbo/pjax)
document.addEventListener('turbo:load', () => {
  console.log('[Gitnotate] turbo:load event fired');
  init().catch(console.error);
});
document.addEventListener('turbo:render', () => {
  console.log('[Gitnotate] turbo:render event fired');
  init().catch(console.error);
});
// Fallback: watch for URL changes via popstate
window.addEventListener('popstate', () => {
  console.log('[Gitnotate] popstate event fired');
  init().catch(console.error);
});

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
