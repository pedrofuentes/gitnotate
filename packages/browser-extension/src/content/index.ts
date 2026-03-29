import { detectGitHubPage, type GitHubPageInfo } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo } from './selection';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights, HIGHLIGHT_COLORS } from './highlighter';
import { showOptInBanner, hideOptInBanner } from './ui/optin-banner';
import { isRepoEnabled, enableRepo, isRepoBlocked, blockRepo } from '../storage/repo-settings';
import { initFileViewComments } from './file-view-handler';
import { findClosestTextarea, injectGnMetadata } from './textarea-target';
import './highlighter.css';
import './ui/optin-banner.css';
import { debug } from './logger';

let currentPageInfo: GitHubPageInfo = detectGitHubPage();
let featureAbort: AbortController | null = null;

debug('[Gitnotate] Content script loaded at:', window.location.href);

async function init(): Promise<void> {
  currentPageInfo = detectGitHubPage();
  debug('[Gitnotate] init() called');
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
  // Abort previous event listeners to avoid double-registration
  // when init() is called again (e.g. turbo:load navigation).
  featureAbort?.abort();
  featureAbort = new AbortController();
  const { signal } = featureAbort;

  hideOptInBanner();

  if (pageInfo.type === 'file-view' && pageInfo.filePath) {
    initFileViewComments(pageInfo);
  }

  if (pageInfo.type === 'pr-files-changed') {
    debug('[Gitnotate] PR diff page detected, initializing...');

    // Track one pending highlight per textarea so multiple selections
    // can coexist across different inline comment forms.
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

        const textarea = findClosestTextarea(selInfo.lineElement, selInfo.lineNumber);
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

function hideGnMetadataInComment(commentEl: HTMLElement): void {
  // Don't hide metadata inside textareas — those are pending comments
  // that need the ^gn tag visible in the editable text.
  if (commentEl.closest('textarea') || commentEl.querySelector('textarea')) {
    return;
  }

  const text = commentEl.textContent ?? '';
  const cleaned = text.replace(/\^gn:\d+:\d+:\d+/, '').trim();

  if (!cleaned) {
    commentEl.style.display = 'none';
  } else {
    const walker = document.createTreeWalker(commentEl, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && /\^gn:\d+:\d+:\d+/.test(node.textContent)) {
        // Don't touch text nodes inside textareas or form inputs
        if (node.parentElement?.closest('textarea, input')) continue;
        const span = document.createElement('span');
        span.style.display = 'none';
        span.textContent = node.textContent;
        node.replaceWith(span);
        break;
      }
    }
  }
}

/**
 * Apply a colored left border to the comment thread container to
 * visually associate it with its highlight color.
 *
 * For submitted comments: colors the author name link.
 * For pending comment boxes: colors the "Add a comment on line" heading.
 */
function colorizeCommentThread(commentEl: HTMLElement, colorIndex: number): void {
  const color = HIGHLIGHT_COLORS[colorIndex % HIGHLIGHT_COLORS.length];

  // Walk up from the ^gn container to find the thread root
  const threadContainer =
    commentEl.closest('[data-marker-id]') ??
    commentEl.closest('[data-testid="review-thread"]')?.parentElement ??
    commentEl.closest('.inline-comment-form');
  if (!threadContainer) return;

  // Apply a colored left border to the thread container
  (threadContainer as HTMLElement).style.borderLeft = `3px solid ${color}`;
  (threadContainer as HTMLElement).setAttribute('data-gn-color-indicator', 'true');

  // For submitted comments: color the author name
  const authorLink = threadContainer.querySelector<HTMLElement>(
    '[data-testid="avatar-link"], .ActivityHeader-module__AuthorName__VJr9h',
  );
  if (authorLink) {
    authorLink.style.color = color;
    authorLink.setAttribute('data-gn-color-indicator', 'true');
  }

  // For pending comment boxes: color the "Add a comment on line" heading
  const heading = threadContainer.querySelector<HTMLElement>(
    '.InlineReviewThread-module__inlineReviewThreadHeading__o7jqD, h4.prc-Heading-Heading-MtWFE',
  );
  if (heading) {
    heading.style.color = color;
    heading.setAttribute('data-gn-color-indicator', 'true');
  }
}

/**
 * Remove all color indicators applied by colorizeCommentThread.
 */
function clearCommentColorIndicators(): void {
  const indicators = document.querySelectorAll<HTMLElement>('[data-gn-color-indicator]');
  for (const el of indicators) {
    el.style.borderLeft = '';
    el.style.color = '';
    el.removeAttribute('data-gn-color-indicator');
  }
}
