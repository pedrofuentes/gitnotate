import type { TextSelectionInfo } from '../selection';

export interface CommentFormOptions {
  selectionInfo: TextSelectionInfo;
  onSubmit: (userComment: string) => Promise<void>;
  onCancel: () => void;
}

let currentForm: HTMLElement | null = null;

/**
 * Show a comment form near the selected text for the user to type a comment.
 * Removes any previously shown form first.
 */
export function showCommentForm(options: CommentFormOptions): HTMLElement {
  hideCommentForm();

  const { selectionInfo, onSubmit, onCancel } = options;

  const form = document.createElement('div');
  form.className = 'gn-comment-form';

  // Position near the selection
  let top = 0;
  let left = 0;
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      top = rect.bottom + window.scrollY + 8;
      left = rect.left + window.scrollX;
    }
  } catch {
    const rect = selectionInfo.lineElement.getBoundingClientRect();
    top = rect.bottom + window.scrollY + 8;
    left = rect.left + window.scrollX;
  }

  form.style.position = 'absolute';
  form.style.top = `${top}px`;
  form.style.left = `${left}px`;
  form.style.zIndex = '2147483647';

  // Preview of selected text
  const preview = document.createElement('div');
  preview.className = 'gn-comment-form-preview';
  preview.textContent = `📌 "${selectionInfo.exact}"`;
  form.appendChild(preview);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'gn-comment-form-textarea';
  textarea.placeholder = 'Add your comment…';
  textarea.rows = 3;
  form.appendChild(textarea);

  // Error container (hidden by default)
  const errorEl = document.createElement('div');
  errorEl.className = 'gn-comment-form-error';
  errorEl.style.display = 'none';
  form.appendChild(errorEl);

  // Buttons
  const actions = document.createElement('div');
  actions.className = 'gn-comment-form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'gn-comment-form-cancel';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'gn-comment-form-submit';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Submit';

  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);
  form.appendChild(actions);

  // --- Behavior ---

  function setLoading(loading: boolean): void {
    if (loading) {
      form.classList.add('gn-comment-form-loading');
      submitBtn.disabled = true;
      textarea.disabled = true;
    } else {
      form.classList.remove('gn-comment-form-loading');
      submitBtn.disabled = false;
      textarea.disabled = false;
    }
  }

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.style.display = '';
  }

  function clearError(): void {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  async function handleSubmit(): Promise<void> {
    const text = textarea.value;
    clearError();
    setLoading(true);

    try {
      await onSubmit(text);
      // Success: remove the form
      hideCommentForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      showError(message);
      setLoading(false);
    }
  }

  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    void handleSubmit();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    onCancel();
  });

  // Keyboard shortcuts
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      void handleSubmit();
    }
  });

  document.body.appendChild(form);
  currentForm = form;

  // Auto-focus textarea
  textarea.focus();

  return form;
}

/**
 * Remove the comment form from the DOM (if present).
 */
export function hideCommentForm(): void {
  if (currentForm && currentForm.parentNode) {
    currentForm.parentNode.removeChild(currentForm);
  }
  currentForm = null;
}
