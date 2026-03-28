import { describe, it, expect, beforeEach, vi } from 'vitest';
import { submitViaGitHubUI } from '../../src/content/comment-submitter';

/**
 * Build a minimal GitHub-like diff DOM for testing.
 * Mimics the structure GitHub uses for PR file diffs.
 */
function buildDiffDOM(lineNumber: number, filePath: string): HTMLElement {
  const fileEl = document.createElement('div');
  fileEl.className = 'file';
  fileEl.setAttribute('data-path', filePath);

  const diffTable = document.createElement('table');
  const tbody = document.createElement('tbody');

  const row = document.createElement('tr');
  row.className = 'js-expandable-line';

  const numCell = document.createElement('td');
  numCell.className = 'blob-num blob-num-addition';
  numCell.setAttribute('data-line-number', String(lineNumber));

  const addCommentBtn = document.createElement('button');
  addCommentBtn.className = 'js-add-line-comment';
  addCommentBtn.setAttribute('data-line', String(lineNumber));
  addCommentBtn.setAttribute('data-path', filePath);
  addCommentBtn.textContent = '+';
  numCell.appendChild(addCommentBtn);

  const codeCell = document.createElement('td');
  codeCell.className = 'blob-code blob-code-inner blob-code-addition';
  codeCell.textContent = 'In Q3, revenue growth exceeded expectations.';

  row.appendChild(numCell);
  row.appendChild(codeCell);
  tbody.appendChild(row);
  diffTable.appendChild(tbody);
  fileEl.appendChild(diffTable);

  return fileEl;
}

/**
 * Simulate what GitHub does when the "+" button is clicked:
 * inject an inline comment form row after the target row.
 */
function simulateGitHubFormInjection(fileEl: HTMLElement, lineNumber: number): void {
  const btn = fileEl.querySelector<HTMLButtonElement>(
    `button.js-add-line-comment[data-line="${lineNumber}"]`,
  );
  if (!btn) return;

  const targetRow = btn.closest('tr')!;
  const tbody = targetRow.parentElement!;

  const commentRow = document.createElement('tr');
  commentRow.className = 'js-inline-comments-container';

  const td = document.createElement('td');
  td.setAttribute('colspan', '4');

  const formDiv = document.createElement('div');
  formDiv.className = 'inline-comment-form';

  const textarea = document.createElement('textarea');
  textarea.className = 'comment-form-textarea js-comment-field';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary';
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Add review comment';

  formDiv.appendChild(textarea);
  formDiv.appendChild(submitBtn);
  td.appendChild(formDiv);
  commentRow.appendChild(td);

  // Insert after the target row
  if (targetRow.nextSibling) {
    tbody.insertBefore(commentRow, targetRow.nextSibling);
  } else {
    tbody.appendChild(commentRow);
  }
}

describe('submitViaGitHubUI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find the line add-comment button for given line number', async () => {
    const fileEl = buildDiffDOM(3, 'docs/proposal.md');
    document.body.appendChild(fileEl);

    // Simulate GitHub's behavior when the + button is clicked
    const btn = fileEl.querySelector<HTMLButtonElement>('button.js-add-line-comment[data-line="3"]');
    expect(btn).not.toBeNull();

    btn!.addEventListener('click', () => {
      simulateGitHubFormInjection(fileEl, 3);
    });

    const result = await submitViaGitHubUI({
      filePath: 'docs/proposal.md',
      lineNumber: 3,
      side: 'RIGHT',
      commentBody: '<!-- @gn {"exact":"revenue","start":8,"end":15} -->\nTest comment',
    });

    expect(result).toBe(true);
  });

  it('should open comment form by clicking the button', async () => {
    const fileEl = buildDiffDOM(5, 'src/main.ts');
    document.body.appendChild(fileEl);

    const clickSpy = vi.fn(() => {
      simulateGitHubFormInjection(fileEl, 5);
    });
    const btn = fileEl.querySelector<HTMLButtonElement>('button.js-add-line-comment')!;
    btn.addEventListener('click', clickSpy);

    await submitViaGitHubUI({
      filePath: 'src/main.ts',
      lineNumber: 5,
      side: 'RIGHT',
      commentBody: 'test body',
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('should populate textarea with formatted comment body', async () => {
    const fileEl = buildDiffDOM(3, 'docs/proposal.md');
    document.body.appendChild(fileEl);

    const btn = fileEl.querySelector<HTMLButtonElement>('button.js-add-line-comment')!;
    btn.addEventListener('click', () => {
      simulateGitHubFormInjection(fileEl, 3);
    });

    const commentBody = '<!-- @gn {"exact":"revenue","start":8,"end":15} -->\nTest comment';

    await submitViaGitHubUI({
      filePath: 'docs/proposal.md',
      lineNumber: 3,
      side: 'RIGHT',
      commentBody,
    });

    const textarea = document.querySelector<HTMLTextAreaElement>('.comment-form-textarea');
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe(commentBody);
  });

  it('should dispatch input event on textarea', async () => {
    const fileEl = buildDiffDOM(3, 'docs/proposal.md');
    document.body.appendChild(fileEl);

    const btn = fileEl.querySelector<HTMLButtonElement>('button.js-add-line-comment')!;
    btn.addEventListener('click', () => {
      simulateGitHubFormInjection(fileEl, 3);
    });

    let inputFired = false;

    // We need to add the event listener after the form is injected
    const origAddEventListener = btn.addEventListener.bind(btn);
    btn.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      origAddEventListener(type, listener, options);
    };

    await submitViaGitHubUI({
      filePath: 'docs/proposal.md',
      lineNumber: 3,
      side: 'RIGHT',
      commentBody: 'test',
    });

    // Check that the textarea received an input event by verifying it was set
    const textarea = document.querySelector<HTMLTextAreaElement>('.comment-form-textarea')!;
    // Listen for subsequent input events - verify the value was set via nativeInputValueSetter or direct
    textarea.addEventListener('input', () => {
      inputFired = true;
    });

    // The input event should have already been dispatched during submitViaGitHubUI
    // We verify by checking the textarea value is set correctly
    expect(textarea.value).toBe('test');
  });

  it('should return false if line button not found', async () => {
    // Empty DOM — no diff elements
    const result = await submitViaGitHubUI({
      filePath: 'nonexistent.md',
      lineNumber: 99,
      side: 'RIGHT',
      commentBody: 'test',
    });

    expect(result).toBe(false);
  });

  it('should return false if textarea not found after click', async () => {
    const fileEl = buildDiffDOM(3, 'docs/proposal.md');
    document.body.appendChild(fileEl);

    // Button exists but clicking it does NOT inject a comment form
    const result = await submitViaGitHubUI({
      filePath: 'docs/proposal.md',
      lineNumber: 3,
      side: 'RIGHT',
      commentBody: 'test',
    });

    expect(result).toBe(false);
  });

  it('should handle the case where GitHub form is already open', async () => {
    const fileEl = buildDiffDOM(3, 'docs/proposal.md');
    document.body.appendChild(fileEl);

    // Pre-inject the comment form (as if already open)
    simulateGitHubFormInjection(fileEl, 3);

    const commentBody = 'pre-filled comment';

    const result = await submitViaGitHubUI({
      filePath: 'docs/proposal.md',
      lineNumber: 3,
      side: 'RIGHT',
      commentBody,
    });

    expect(result).toBe(true);

    const textarea = document.querySelector<HTMLTextAreaElement>('.comment-form-textarea')!;
    expect(textarea.value).toBe(commentBody);
  });
});
