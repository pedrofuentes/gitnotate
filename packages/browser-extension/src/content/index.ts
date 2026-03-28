import { buildGnComment } from '@gitnotate/core';
import { detectGitHubPage, type GitHubPageInfo } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo, type TextSelectionInfo } from './selection';
import { scanForGnComments } from './comment-scanner';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import { showOptInBanner, hideOptInBanner } from './ui/optin-banner';
import { isRepoEnabled, enableRepo } from '../storage/repo-settings';
import { initFileViewComments } from './file-view-handler';
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

        const textarea = findOpenCommentTextarea();
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
      if (pendingHighlight && !findOpenCommentTextarea()) {
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

    // Periodically re-scan to catch comments being added or removed
    // (e.g., draft cancelled, new comment submitted)
    const rescanObserver = new MutationObserver(() => {
      // Debounce: only re-scan after DOM settles
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        scanAndHighlight();
      }, 500);
    });
    let rescanTimer: ReturnType<typeof setTimeout>;
    rescanObserver.observe(document.body, { childList: true, subtree: true });
  }
}

// --- Find open comment textarea ---

function findOpenCommentTextarea(): HTMLTextAreaElement | null {
  const selectors = [
    'textarea[name="comment[body]"]',
    'textarea.js-comment-field',
    'textarea.comment-form-textarea',
    'textarea[aria-label*="comment" i]',
    'textarea[aria-label*="review" i]',
    'textarea[placeholder*="comment" i]',
    'textarea[placeholder*="Leave" i]',
    'textarea[placeholder*="write" i]',
    'textarea[placeholder*="reply" i]',
    '.inline-comment-form textarea',
    'markdown-toolbar textarea',
  ];

  for (const sel of selectors) {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>(sel);
    for (const ta of textareas) {
      // Must be visible
      if (ta.offsetParent !== null || ta.offsetHeight > 0) return ta;
    }
  }
  return null;
}

function injectGnMetadata(textarea: HTMLTextAreaElement, selInfo: TextSelectionInfo): void {
  const metadata = {
    exact: selInfo.exact,
    start: selInfo.start,
    end: selInfo.end,
  };
  const prefix = buildGnComment(metadata, '');
  const value = prefix + '\n\n';

  // Use native setter to work with React-controlled inputs
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }

  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // Place cursor at the end so user can start typing
  textarea.focus();
  textarea.setSelectionRange(value.length, value.length);
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
