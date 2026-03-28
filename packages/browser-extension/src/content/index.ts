import { detectGitHubPage, type GitHubPageInfo } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo } from './selection';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import { showOptInBanner, hideOptInBanner } from './ui/optin-banner';
import { isRepoEnabled, enableRepo } from '../storage/repo-settings';
import { initFileViewComments } from './file-view-handler';
import { findClosestTextarea, injectGnMetadata } from './textarea-target';
import './highlighter.css';
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

    let pendingHighlight: HTMLElement | null = null;

    // When user selects text while a comment textarea is open,
    // inject @gn metadata into the textarea
    document.addEventListener('mouseup', () => {
      setTimeout(() => {
        const selInfo = getSelectionInfo();
        if (!selInfo) return;

        // Save the range before focus changes clear it
        const sel = window.getSelection();
        let savedRange: Range | null = null;
        if (sel && sel.rangeCount > 0) {
          savedRange = sel.getRangeAt(0).cloneRange();
        }

        const textarea = findClosestTextarea(selInfo.lineElement);
        if (!textarea) return;

        console.log('[Gitnotate] Selection + open textarea detected, injecting @gn metadata');
        injectGnMetadata(textarea, selInfo);

        // Highlight the selected text using the saved range
        if (savedRange) {
          try {
            // Remove previous pending highlight if any
            removePendingHighlight();

            const span = document.createElement('span');
            span.className = 'gn-highlight gn-highlight-pending';
            span.setAttribute('data-gn-comment-id', `gn-pending`);
            savedRange.surroundContents(span);
            pendingHighlight = span;
            console.log('[Gitnotate] Text highlighted');
          } catch (err) {
            console.log('[Gitnotate] Could not highlight:', err);
          }
        }
      }, 10);
    });

    // Watch for comment forms being removed (cancel/submit)
    // Remove pending highlight when the form disappears
    const formObserver = new MutationObserver(() => {
      if (pendingHighlight && !findClosestTextarea()) {
        console.log('[Gitnotate] Comment form closed, removing pending highlight');
        removePendingHighlight();
      }
    });
    formObserver.observe(document.body, { childList: true, subtree: true });

    function removePendingHighlight(): void {
      if (!pendingHighlight) return;
      const parent = pendingHighlight.parentNode;
      if (parent) {
        while (pendingHighlight.firstChild) {
          parent.insertBefore(pendingHighlight.firstChild, pendingHighlight);
        }
        parent.removeChild(pendingHighlight);
        parent.normalize();
      }
      pendingHighlight = null;
    }

    observeDiffContent((diffElements) => {
      console.log('[Gitnotate] Diff elements loaded:', diffElements.length);
      scanAndHighlight();
    });

    // Re-scan when comment forms appear or disappear (not on every DOM change)
    let lastCommentCount = 0;
    let lastTextareaCount = 0;
    const rescanObserver = new MutationObserver(() => {
      // Only re-scan if the number of comment bodies or textareas changed
      const commentBodies = document.querySelectorAll('.comment-body, .markdown-body, [data-testid="markdown-body"]').length;
      const textareas = document.querySelectorAll('textarea').length;
      
      if (commentBodies !== lastCommentCount || textareas !== lastTextareaCount) {
        lastCommentCount = commentBodies;
        lastTextareaCount = textareas;
        clearTimeout(rescanTimer);
        rescanTimer = setTimeout(() => {
          scanAndHighlight();
        }, 500);
      }
    });
    let rescanTimer: ReturnType<typeof setTimeout>;
    rescanObserver.observe(document.body, { childList: true, subtree: true });
  }
}


// --- Init and navigation ---

console.log('[Gitnotate] Running initial init()');
init().catch(console.error);

document.addEventListener('turbo:load', () => {
  console.log('[Gitnotate] turbo:load event fired');
  init().catch(console.error);
});
document.addEventListener('turbo:render', () => {
  console.log('[Gitnotate] turbo:render event fired');
  init().catch(console.error);
});
window.addEventListener('popstate', () => {
  console.log('[Gitnotate] popstate event fired');
  init().catch(console.error);
});

let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    console.log('[Gitnotate] URL changed:', lastUrl, '→', window.location.href);
    lastUrl = window.location.href;
    init().catch(console.error);
  }
});
urlObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', () => {
  setTimeout(() => {
    if (window.location.href !== lastUrl) {
      console.log('[Gitnotate] URL changed (after click):', lastUrl, '→', window.location.href);
      lastUrl = window.location.href;
      init().catch(console.error);
    }
  }, 300);
}, true);

// --- Scan and highlight ---

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

function hideGnMetadataInComment(commentEl: HTMLElement): void {
  const body = commentEl.querySelector('.comment-body');
  if (!body) return;

  for (const child of Array.from(body.children)) {
    if (child.tagName === 'P' && child.textContent?.includes('<!-- @gn')) {
      (child as HTMLElement).style.display = 'none';
      continue;
    }
    if (child.tagName === 'BLOCKQUOTE' && child.textContent?.includes('📌')) {
      (child as HTMLElement).style.display = 'none';
    }
  }
}
