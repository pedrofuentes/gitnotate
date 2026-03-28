import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showCommentForm, hideCommentForm } from '../../../src/content/ui/comment-form';
import type { TextSelectionInfo } from '../../../src/content/selection';

function makeSelectionInfo(overrides: Partial<TextSelectionInfo> = {}): TextSelectionInfo {
  const el = document.createElement('td');
  el.className = 'blob-code blob-code-inner';
  el.textContent = 'In Q3, revenue growth exceeded expectations.';

  return {
    exact: 'revenue growth',
    start: 8,
    end: 22,
    lineNumber: 3,
    filePath: 'docs/proposal.md',
    side: 'RIGHT' as const,
    lineElement: el,
    ...overrides,
  };
}

describe('showCommentForm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    hideCommentForm();
  });

  it('should create form with textarea and buttons', () => {
    const info = makeSelectionInfo();
    const form = showCommentForm({
      selectionInfo: info,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });

    expect(form).toBeInstanceOf(HTMLElement);
    expect(document.body.contains(form)).toBe(true);

    const textarea = form.querySelector('textarea');
    expect(textarea).not.toBeNull();

    const buttons = form.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('should show selected text preview', () => {
    const info = makeSelectionInfo({ exact: 'revenue growth' });
    const form = showCommentForm({
      selectionInfo: info,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });

    // The form should contain the selected text as a preview
    expect(form.textContent).toContain('revenue growth');
    // Should have a pin emoji in the preview
    expect(form.textContent).toContain('📌');
  });

  it('should call onSubmit with user comment text', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const info = makeSelectionInfo();
    const form = showCommentForm({
      selectionInfo: info,
      onSubmit,
      onCancel: vi.fn(),
    });

    const textarea = form.querySelector('textarea')!;
    textarea.value = 'This needs clarification';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = form.querySelector<HTMLButtonElement>('.gn-comment-form-submit')!;
    submitBtn.click();

    // Wait for async onSubmit
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith('This needs clarification');
  });

  it('should call onCancel when Cancel clicked', () => {
    const onCancel = vi.fn();
    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit: vi.fn(),
      onCancel,
    });

    const cancelBtn = form.querySelector<HTMLButtonElement>('.gn-comment-form-cancel')!;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Escape pressed', () => {
    const onCancel = vi.fn();
    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit: vi.fn(),
      onCancel,
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    form.dispatchEvent(event);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should submit on Ctrl+Enter', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit,
      onCancel: vi.fn(),
    });

    const textarea = form.querySelector('textarea')!;
    textarea.value = 'Quick note';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    });
    textarea.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith('Quick note');
  });

  it('should show loading state during submission', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn().mockReturnValue(submitPromise);

    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit,
      onCancel: vi.fn(),
    });

    const textarea = form.querySelector('textarea')!;
    textarea.value = 'test';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = form.querySelector<HTMLButtonElement>('.gn-comment-form-submit')!;
    submitBtn.click();

    // During submission, the form should show loading state
    await vi.waitFor(() => {
      expect(form.classList.contains('gn-comment-form-loading')).toBe(true);
    });
    expect(submitBtn.disabled).toBe(true);
    expect(textarea.disabled).toBe(true);

    resolveSubmit!();
    await submitPromise;
  });

  it('should show error state on failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));

    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit,
      onCancel: vi.fn(),
    });

    const textarea = form.querySelector('textarea')!;
    textarea.value = 'test';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = form.querySelector<HTMLButtonElement>('.gn-comment-form-submit')!;
    submitBtn.click();

    await vi.waitFor(() => {
      const errorEl = form.querySelector('.gn-comment-form-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl!.textContent).toContain('Network error');
    });

    // After error, form should not be loading and controls re-enabled
    expect(form.classList.contains('gn-comment-form-loading')).toBe(false);
    expect(submitBtn.disabled).toBe(false);
    expect(textarea.disabled).toBe(false);
  });

  it('should hide form after successful submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit,
      onCancel: vi.fn(),
    });

    const textarea = form.querySelector('textarea')!;
    textarea.value = 'done';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const submitBtn = form.querySelector<HTMLButtonElement>('.gn-comment-form-submit')!;
    submitBtn.click();

    await vi.waitFor(() => {
      expect(document.body.contains(form)).toBe(false);
    });
  });

  it('should use gn- prefixed CSS classes', () => {
    const form = showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });

    const allClasses = form.className.split(/\s+/);
    expect(allClasses.some((cls) => cls.startsWith('gn-'))).toBe(true);

    // Key child elements should also use gn- prefix
    expect(form.querySelector('.gn-comment-form-preview')).not.toBeNull();
    expect(form.querySelector('.gn-comment-form-textarea')).not.toBeNull();
    expect(form.querySelector('.gn-comment-form-submit')).not.toBeNull();
    expect(form.querySelector('.gn-comment-form-cancel')).not.toBeNull();
  });

  it('should remove previous form when showCommentForm is called again', () => {
    showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });
    showCommentForm({
      selectionInfo: makeSelectionInfo({ exact: 'second' }),
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });

    const forms = document.querySelectorAll('.gn-comment-form');
    expect(forms.length).toBe(1);
  });
});

describe('hideCommentForm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should remove the form from the DOM', () => {
    showCommentForm({
      selectionInfo: makeSelectionInfo(),
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    });

    expect(document.querySelector('.gn-comment-form')).not.toBeNull();
    hideCommentForm();
    expect(document.querySelector('.gn-comment-form')).toBeNull();
  });

  it('should be safe to call when no form exists', () => {
    expect(() => hideCommentForm()).not.toThrow();
  });
});
