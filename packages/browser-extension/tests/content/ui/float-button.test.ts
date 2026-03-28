import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showFloatButton, hideFloatButton } from '../../../src/content/ui/float-button';
import type { TextSelectionInfo } from '../../../src/content/selection';

function makeSelectionInfo(overrides: Partial<TextSelectionInfo> = {}): TextSelectionInfo {
  const el = document.createElement('td');
  el.className = 'blob-code blob-code-inner';
  el.textContent = 'some code text here';

  return {
    exact: 'code',
    start: 5,
    end: 9,
    lineNumber: 7,
    filePath: 'src/index.ts',
    side: 'RIGHT' as const,
    lineElement: el,
    ...overrides,
  };
}

describe('showFloatButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    hideFloatButton();
  });

  it('should create a float button element in the DOM', () => {
    const info = makeSelectionInfo();
    const onComment = vi.fn();

    const btn = showFloatButton(info, onComment);

    expect(btn).toBeInstanceOf(HTMLElement);
    expect(document.body.contains(btn)).toBe(true);
  });

  it('should use gn- prefixed CSS classes', () => {
    const info = makeSelectionInfo();
    const btn = showFloatButton(info, vi.fn());

    // The button or its container should use gn- prefix
    const allClasses = btn.className.split(/\s+/);
    expect(allClasses.some((cls) => cls.startsWith('gn-'))).toBe(true);
  });

  it('should call onComment callback when clicked', () => {
    const info = makeSelectionInfo();
    const onComment = vi.fn();

    const btn = showFloatButton(info, onComment);
    btn.click();

    expect(onComment).toHaveBeenCalledTimes(1);
    expect(onComment).toHaveBeenCalledWith(info);
  });

  it('should position using fixed/absolute positioning styles', () => {
    const info = makeSelectionInfo();
    const btn = showFloatButton(info, vi.fn());

    const position = btn.style.position;
    expect(['fixed', 'absolute']).toContain(position);
  });

  it('should have a tooltip or title attribute', () => {
    const info = makeSelectionInfo();
    const btn = showFloatButton(info, vi.fn());

    // Button or a child should have a title
    const title = btn.title || btn.querySelector('[title]')?.getAttribute('title') || '';
    expect(title.toLowerCase()).toContain('comment');
  });
});

describe('hideFloatButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should remove the float button from the DOM', () => {
    const info = makeSelectionInfo();
    showFloatButton(info, vi.fn());

    // Button should be in DOM
    expect(document.querySelector('.gn-float-btn')).not.toBeNull();

    hideFloatButton();

    // Button should be gone
    expect(document.querySelector('.gn-float-btn')).toBeNull();
  });

  it('should be safe to call when no button exists', () => {
    expect(() => hideFloatButton()).not.toThrow();
  });

  it('should remove previous button when showFloatButton is called again', () => {
    const info1 = makeSelectionInfo({ exact: 'first' });
    const info2 = makeSelectionInfo({ exact: 'second' });

    showFloatButton(info1, vi.fn());
    showFloatButton(info2, vi.fn());

    const buttons = document.querySelectorAll('.gn-float-btn');
    expect(buttons.length).toBe(1);
  });
});
