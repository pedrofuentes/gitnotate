export interface SubmitCommentOptions {
  filePath: string;
  lineNumber: number;
  side: 'LEFT' | 'RIGHT';
  /** The full body including @gn metadata */
  commentBody: string;
}

/**
 * Small delay helper to let GitHub's DOM settle after a click.
 */
function waitForDOM(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find the existing inline comment textarea for a given file + line,
 * if GitHub's form is already open.
 */
function findExistingTextarea(fileEl: HTMLElement, lineNumber: number): HTMLTextAreaElement | null {
  // Look for a line-number cell matching this line
  const lineNumCell = fileEl.querySelector<HTMLElement>(
    `td.blob-num[data-line-number="${lineNumber}"]`,
  );
  if (!lineNumCell) return null;

  const targetRow = lineNumCell.closest('tr');
  if (!targetRow) return null;

  // The comment form row is the next sibling with class js-inline-comments-container
  let nextRow = targetRow.nextElementSibling;
  while (nextRow) {
    if (nextRow.classList.contains('js-inline-comments-container')) {
      const textarea = nextRow.querySelector<HTMLTextAreaElement>(
        'textarea.comment-form-textarea, textarea.js-comment-field',
      );
      if (textarea) return textarea;
    }
    // Only check immediate next sibling(s) that are comment containers
    if (!nextRow.classList.contains('js-inline-comments-container')) break;
    nextRow = nextRow.nextElementSibling;
  }

  return null;
}

/**
 * Set a textarea's value and dispatch an input event so that
 * GitHub's React/JS framework registers the change.
 */
function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Submit a comment by opening GitHub's native inline comment form and
 * pre-filling it with the @gn-formatted body.
 *
 * This piggybacks on the user's logged-in session — no separate auth needed.
 *
 * Returns `true` if the form was successfully populated, `false` otherwise.
 */
export async function submitViaGitHubUI(options: SubmitCommentOptions): Promise<boolean> {
  const { filePath, lineNumber, commentBody } = options;

  // Find the file container
  const escapedPath = filePath.replace(/"/g, '\\"');
  const fileEl = document.querySelector<HTMLElement>(`.file[data-path="${escapedPath}"]`);
  if (!fileEl) return false;

  // Check if the comment form is already open for this line
  const existingTextarea = findExistingTextarea(fileEl, lineNumber);
  if (existingTextarea) {
    setTextareaValue(existingTextarea, commentBody);
    existingTextarea.focus();
    return true;
  }

  // Find the "+" button that opens the inline comment form
  const addBtn = fileEl.querySelector<HTMLButtonElement>(
    `button.js-add-line-comment[data-line="${lineNumber}"]`,
  );
  if (!addBtn) return false;

  // Click it to open GitHub's native comment form
  addBtn.click();

  // Wait for GitHub to inject the inline comment form
  await waitForDOM(150);

  // Find the textarea that GitHub just inserted
  const textarea = findExistingTextarea(fileEl, lineNumber);
  if (!textarea) return false;

  setTextareaValue(textarea, commentBody);
  textarea.focus();

  return true;
}
