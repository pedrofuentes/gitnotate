import { debug } from './logger';
import { TEXTAREA_SELECTORS } from './textarea-target';

export interface SubmitCommentOptions {
  filePath: string;
  lineNumber: number;
  side: 'LEFT' | 'RIGHT';
  /** The full body including ^gn metadata */
  commentBody: string;
}

function waitForDOM(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Set a textarea's value and dispatch events so frameworks register the change.
 */
function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  // For React-controlled inputs, we need to use the native setter
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Try to find any open comment textarea on the page near the target line.
 */
function findAnyOpenTextarea(): HTMLTextAreaElement | null {
  for (const sel of TEXTAREA_SELECTORS) {
    const ta = document.querySelector<HTMLTextAreaElement>(sel);
    if (ta && ta.offsetParent !== null) return ta; // visible textarea
  }
  return null;
}

/**
 * Try to click the "add comment" button on a diff line.
 * Returns true if a button was found and clicked.
 */
function clickAddCommentButton(lineNumber: number): boolean {
  // Old GitHub UI
  const oldBtn = document.querySelector<HTMLButtonElement>(
    `button.js-add-line-comment[data-line="${lineNumber}"]`
  );
  if (oldBtn) { oldBtn.click(); return true; }

  // New GitHub UI: the "+" button appears on hover, often as a button
  // inside the line number cell. Try various selectors.
  const selectors = [
    `button[data-line="${lineNumber}"][data-side]`,
    `button[data-line-number="${lineNumber}"]`,
    `[data-line-number="${lineNumber}"] button`,
  ];
  for (const sel of selectors) {
    const btn = document.querySelector<HTMLButtonElement>(sel);
    if (btn) { btn.click(); return true; }
  }

  // Try finding the row and triggering comment via the line number cell
  const allLineNums = document.querySelectorAll<HTMLElement>(
    `[data-line-number="${lineNumber}"]`
  );
  for (const el of allLineNums) {
    const btn = el.querySelector<HTMLButtonElement>('button');
    if (btn) { btn.click(); return true; }
  }

  return false;
}

/**
 * Submit a comment by:
 * 1. Trying to open GitHub's native inline comment form and pre-fill it
 * 2. If that fails, copy the comment to clipboard for manual paste
 */
export async function submitViaGitHubUI(options: SubmitCommentOptions): Promise<boolean> {
  const { lineNumber, commentBody } = options;

  // Strategy 1: Try to click the add-comment button on the line
  const clicked = clickAddCommentButton(lineNumber);

  if (clicked) {
    // Wait for form to appear
    await waitForDOM(300);

    const textarea = findAnyOpenTextarea();
    if (textarea) {
      setTextareaValue(textarea, commentBody);
      textarea.focus();
      return true;
    }

    // Wait a bit more — some UIs are slow
    await waitForDOM(500);

    const textarea2 = findAnyOpenTextarea();
    if (textarea2) {
      setTextareaValue(textarea2, commentBody);
      textarea2.focus();
      return true;
    }
  }

  // Strategy 2: Check if there's already an open textarea (user may have
  // already clicked "+" manually)
  const existingTextarea = findAnyOpenTextarea();
  if (existingTextarea) {
    setTextareaValue(existingTextarea, commentBody);
    existingTextarea.focus();
    return true;
  }

  // Strategy 3: Copy to clipboard and let user paste manually
  try {
    await navigator.clipboard.writeText(commentBody);
    // Return true since we got the comment ready — just needs paste
    debug('[Gitnotate] Comment copied to clipboard. Click "+" on the diff line and paste.');
    
    // Show a brief notification on the page
    const notice = document.createElement('div');
    notice.className = 'gn-clipboard-notice';
    notice.textContent = '📋 Comment copied! Click the "+" on the diff line, then paste (Ctrl+V).';
    notice.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      background: #24292e; color: #fff; padding: 12px 20px; border-radius: 8px;
      font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: gn-fade-in 0.2s ease-out;
    `;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 5000);

    return true;
  } catch {
    return false;
  }
}
