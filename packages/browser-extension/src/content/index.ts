import { detectGitHubPage, type GitHubPageInfo } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo } from './selection';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import { hideGnMetadataInComment } from './metadata-hider';
import { colorizeCommentThread, clearCommentColorIndicators } from './thread-colorizer';
import { createObserverLifecycle, type ObserverLifecycle } from './observer-lifecycle';
import { showOptInBanner, hideOptInBanner } from './ui/optin-banner';
import { isRepoEnabled, enableRepo, isRepoBlocked, blockRepo } from '../storage/repo-settings';
import { getHighlightStyle, applyHighlightStyle } from '../storage/highlight-style';
import { initFileViewComments } from './file-view-handler';
import { findClosestTextarea, injectGnMetadata } from './textarea-target';
import './highlighter.css';
import './ui/optin-banner.css';
import { debug } from './logger';

let currentPageInfo: GitHubPageInfo = detectGitHubPage();
let featureLifecycle: ObserverLifecycle | null = null;

debug('[Gitnotate] Content script loaded at:', window.location.href);

async function init(): Promise<void> {
  currentPageInfo = detectGitHubPage();
  debug('[Gitnotate] init() called');

  // Apply highlight style preference
  const style = await getHighlightStyle();
  applyHighlightStyle(style);
  debug('[Gitnotate] URL:', window.location.pathname);
  debug('[Gitnotate] Page detected:', JSON.stringify(currentPageInfo));

  if (currentPageInfo.type === 'other' || !currentPageInfo.owner || !currentPageInfo.repo) {
    debug('[Gitnotate] Skipping — page type is "other" or missing owner/repo');
    return;
  }

  debug('[Gitnotate] Checking if repo is enabled:', `${currentPageInfo.owner}/${currentPageInfo.repo}`);
  const enabled = await isRepoEnabled(currentPageInfo.owner, currentPageInfo.repo);
  debug('[Gitnotate] Repo enabled:', enabled);

  if (!enabled) {
    const blocked = await isRepoBlocked(currentPageInfo.owner, currentPageInfo.repo);
    if (blocked) {
      debug('[Gitnotate] Repo blocked, skipping');
      return;
    }

    debug('[Gitnotate] Repo not enabled, page type:', currentPageInfo.type);
    if (currentPageInfo.type === 'pr-files-changed' || currentPageInfo.type === 'pr-conversation') {
      debug('[Gitnotate] Showing opt-in banner');
      const pageRef = currentPageInfo;
      showOptInBanner(
        pageRef.owner,
        pageRef.repo,
        async () => {
          await enableRepo(pageRef.owner, pageRef.repo);
          debug(`[Gitnotate] Enabled for ${pageRef.owner}/${pageRef.repo}`);
          activateFeatures(pageRef);
        },
        () => {
          debug('[Gitnotate] User dismissed opt-in');
        },
        async () => {
          await blockRepo(pageRef.owner, pageRef.repo);
          debug(`[Gitnotate] Blocked for ${pageRef.owner}/${pageRef.repo}`);
        },
      );
    } else {
      debug('[Gitnotate] Not a PR page, skipping opt-in banner');
    }
    return;
  }

  activateFeatures(currentPageInfo);
}

function activateFeatures(pageInfo: GitHubPageInfo): void {
  // Abort previous lifecycle to disconnect observers and clear timers,
  // avoiding double-registration on turbo:load navigation.
  featureLifecycle?.abort();
  featureLifecycle = createObserverLifecycle();
  const { signal } = featureLifecycle;

  hideOptInBanner();

  if (pageInfo.type === 'file-view' && pageInfo.filePath) {
    initFileViewComments(pageInfo);
  }

  if (pageInfo.type === 'pr-files-changed') {
    debug('[Gitnotate] PR diff page detected, initializing...');

    // Track one pending highlight per textarea so multiple selections
    // can coexist across different inline comment forms.
    // Cleared on each activation to avoid holding detached DOM references.
    const pendingHighlights = new Map<HTMLTextAreaElement, HTMLElement>();

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

        const textarea = findClosestTextarea(selInfo.lineElement, selInfo.lineNumber, selInfo.side);
        if (!textarea) return;

        debug('[Gitnotate] Selection + open textarea detected, injecting ^gn metadata');
        injectGnMetadata(textarea, selInfo);

        // Highlight the selected text using the saved range
        if (savedRange) {
          try {
            // Remove previous pending highlight for THIS textarea only
            removePendingHighlightFor(textarea);

            const span = document.createElement('span');
            span.className = 'gn-highlight gn-highlight-pending';
            span.setAttribute('data-gn-comment-id', `gn-pending`);
            savedRange.surroundContents(span);
            pendingHighlights.set(textarea, span);
            debug('[Gitnotate] Text highlighted');
          } catch (err) {
            debug('[Gitnotate] Could not highlight:', err);
          }
        }
      }, 10);
    }, { signal });

    // Watch for comment forms being removed (cancel/submit)
    // Remove pending highlights for textareas that are no longer in the DOM
    const formObserver = new MutationObserver(() => {
      for (const [textarea] of pendingHighlights) {
        if (!textarea.isConnected) {
          debug('[Gitnotate] Comment form closed, removing pending highlight');
          removePendingHighlightFor(textarea);
        }
      }
    });
    formObserver.observe(document.body, { childList: true, subtree: true });
    featureLifecycle.trackObserver(formObserver);

    function removePendingHighlightFor(textarea: HTMLTextAreaElement): void {
      const highlight = pendingHighlights.get(textarea);
      if (!highlight) return;
      const parent = highlight.parentNode;
      if (parent) {
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
        parent.normalize();
      }
      pendingHighlights.delete(textarea);
    }

    observeDiffContent((diffElements) => {
      debug('[Gitnotate] Diff elements loaded:', diffElements.length);
      scanAndHighlight();
    });

    // Re-scan when comment forms appear or disappear (not on every DOM change)
    let lastCommentCount = 0;
    let lastTextareaCount = 0;
    let rescanTimer: ReturnType<typeof setTimeout>;
    const rescanObserver = new MutationObserver(() => {
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        // Move counting queries inside debounced callback to avoid
        // expensive querySelectorAll on every single mutation
        const commentBodies = document.querySelectorAll('.comment-body, .markdown-body, [data-testid="markdown-body"]').length;
        const textareas = document.querySelectorAll('textarea').length;

        if (commentBodies !== lastCommentCount || textareas !== lastTextareaCount) {
          lastCommentCount = commentBodies;
          lastTextareaCount = textareas;
          scanAndHighlight();
        }
      }, 500);
      featureLifecycle?.trackTimer(rescanTimer);
    });
    rescanObserver.observe(document.body, { childList: true, subtree: true });
    featureLifecycle.trackObserver(rescanObserver);
  }
}


// --- Init and navigation ---

debug('[Gitnotate] Running initial init()');
init().catch(console.error);

document.addEventListener('turbo:load', () => {
  debug('[Gitnotate] turbo:load event fired');
  init().catch(console.error);
});
document.addEventListener('turbo:render', () => {
  debug('[Gitnotate] turbo:render event fired');
  init().catch(console.error);
});
window.addEventListener('popstate', () => {
  debug('[Gitnotate] popstate event fired');
  init().catch(console.error);
});

let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    debug('[Gitnotate] URL changed:', lastUrl, '→', window.location.href);
    lastUrl = window.location.href;
    init().catch(console.error);
  }
});
urlObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', () => {
  setTimeout(() => {
    if (window.location.href !== lastUrl) {
      debug('[Gitnotate] URL changed (after click):', lastUrl, '→', window.location.href);
      lastUrl = window.location.href;
      init().catch(console.error);
    }
  }, 300);
}, true);

// --- Scan and highlight ---

function scanAndHighlight(): void {
  clearAllHighlights();
  clearCommentColorIndicators();
  const gnComments = scanForGnComments();
  debug(`[Gitnotate] Found ${gnComments.length} ^gn comment(s)`);

  for (const gc of gnComments) {
    const { metadata } = gc.parsed;
    const commentId = gc.commentElement.id || `gn-${gc.filePath}-${gc.lineNumber}`;

    const result = highlightTextRange({
      filePath: gc.filePath,
      lineNumber: gc.lineNumber,
      side: metadata.side,
      start: metadata.start,
      end: metadata.end,
      commentId,
    });

    hideGnMetadataInComment(gc.commentElement);

    if (result) {
      colorizeCommentThread(gc.commentElement, result.colorIndex);
    }
  }
}

// hideGnMetadataInComment, colorizeCommentThread, and clearCommentColorIndicators
// are now imported from ./metadata-hider and ./thread-colorizer
