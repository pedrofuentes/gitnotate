import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { observeDiffContent } from '../../src/content/diff-observer';

describe('observeDiffContent', () => {
  let observer: MutationObserver;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  it('should return a MutationObserver instance', () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    expect(observer).toBeInstanceOf(MutationObserver);
  });

  it('should call callback when diff-table elements are added', async () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    const diffTable = document.createElement('table');
    diffTable.classList.add('diff-table');
    document.body.appendChild(diffTable);

    // MutationObserver is async — wait for microtask
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalled();
    const elements = callback.mock.calls[0][0] as HTMLElement[];
    expect(elements.length).toBeGreaterThan(0);
  });

  it('should call callback when data-diff-anchor elements are added', async () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    const el = document.createElement('div');
    el.setAttribute('data-diff-anchor', 'true');
    document.body.appendChild(el);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalled();
  });

  it('should call callback when .file elements are added', async () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    const fileEl = document.createElement('div');
    fileEl.classList.add('file');
    document.body.appendChild(fileEl);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalled();
  });

  it('should not call callback for unrelated DOM changes', async () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    const el = document.createElement('div');
    el.classList.add('unrelated');
    document.body.appendChild(el);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).not.toHaveBeenCalled();
  });

  it('should detect diff elements added inside nested containers', async () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    const container = document.createElement('div');
    const diffTable = document.createElement('table');
    diffTable.classList.add('diff-table');
    container.appendChild(diffTable);
    document.body.appendChild(container);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalled();
  });

  it('should call callback for existing diff elements present at observation start', async () => {
    // Pre-populate DOM with diff content before observing
    const diffTable = document.createElement('table');
    diffTable.classList.add('diff-table');
    document.body.appendChild(diffTable);

    const callback = vi.fn();
    observer = observeDiffContent(callback);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalled();
  });

  it('should be disconnectable', () => {
    const callback = vi.fn();
    observer = observeDiffContent(callback);

    // Should not throw
    expect(() => observer.disconnect()).not.toThrow();
  });

  it('should accept an AbortSignal and remove turbo:load listener on abort', async () => {
    const callback = vi.fn();
    const controller = new AbortController();
    observer = observeDiffContent(callback, { signal: controller.signal });

    // Simulate turbo:load — should fire callback for existing elements
    const diffTable = document.createElement('table');
    diffTable.classList.add('diff-table');
    document.body.appendChild(diffTable);

    document.dispatchEvent(new Event('turbo:load'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const callCountBeforeAbort = callback.mock.calls.length;
    expect(callCountBeforeAbort).toBeGreaterThan(0);

    // Abort and trigger turbo:load again
    controller.abort();
    callback.mockClear();

    document.dispatchEvent(new Event('turbo:load'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should NOT fire callback after abort
    expect(callback).not.toHaveBeenCalled();
  });
});
