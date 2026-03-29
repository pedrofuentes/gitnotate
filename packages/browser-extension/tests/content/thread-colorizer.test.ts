import { describe, it, expect, beforeEach } from 'vitest';
import {
  colorizeCommentThread,
  clearCommentColorIndicators,
} from '../../src/content/thread-colorizer';
import { HIGHLIGHT_COLORS } from '../../src/content/highlighter';

/**
 * Build a minimal thread DOM with optional elements:
 * - thread container with data-marker-id
 * - author link
 * - heading element
 */
function buildThreadDOM(opts?: {
  markerAttr?: string;
  includeAuthorLink?: boolean;
  includeHeading?: boolean;
}): { container: HTMLElement; commentEl: HTMLElement } {
  const container = document.createElement('div');
  if (opts?.markerAttr) {
    container.setAttribute(opts.markerAttr, 'thread-1');
  }

  if (opts?.includeAuthorLink) {
    const link = document.createElement('a');
    link.setAttribute('data-testid', 'avatar-link');
    container.appendChild(link);
  }

  if (opts?.includeHeading) {
    const heading = document.createElement('h4');
    heading.className = 'prc-Heading-Heading-MtWFE';
    container.appendChild(heading);
  }

  const commentEl = document.createElement('p');
  commentEl.textContent = '^gn:1:R:0:5 Some comment';
  container.appendChild(commentEl);

  document.body.appendChild(container);
  return { container, commentEl };
}

describe('colorizeCommentThread', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should apply colored border to thread container with data-marker-id', () => {
    const { commentEl } = buildThreadDOM({ markerAttr: 'data-marker-id' });

    colorizeCommentThread(commentEl, 0);

    const container = commentEl.closest('[data-marker-id]') as HTMLElement;
    expect(container.style.borderLeft).toContain('3px solid');
    expect(container.getAttribute('data-gn-color-indicator')).toBe('true');
  });

  it('should color the author link when present', () => {
    const { commentEl, container } = buildThreadDOM({
      markerAttr: 'data-marker-id',
      includeAuthorLink: true,
    });

    colorizeCommentThread(commentEl, 1);

    const authorLink = container.querySelector('[data-testid="avatar-link"]') as HTMLElement;
    expect(authorLink.style.color).not.toBe('');
    expect(authorLink.getAttribute('data-gn-color-indicator')).toBe('true');
  });

  it('should color the heading when present', () => {
    const { commentEl, container } = buildThreadDOM({
      markerAttr: 'data-marker-id',
      includeHeading: true,
    });

    colorizeCommentThread(commentEl, 2);

    const heading = container.querySelector('h4') as HTMLElement;
    expect(heading.style.color).not.toBe('');
    expect(heading.getAttribute('data-gn-color-indicator')).toBe('true');
  });

  it('should wrap color index around HIGHLIGHT_COLORS length', () => {
    const { commentEl } = buildThreadDOM({ markerAttr: 'data-marker-id' });

    const wrappedIndex = HIGHLIGHT_COLORS.length + 2;
    colorizeCommentThread(commentEl, wrappedIndex);

    const container = commentEl.closest('[data-marker-id]') as HTMLElement;
    expect(container.style.borderLeft).toContain('3px solid');
  });

  it('should do nothing if no thread container is found', () => {
    const el = document.createElement('p');
    document.body.appendChild(el);

    // Should not throw
    colorizeCommentThread(el, 0);
    expect(el.getAttribute('data-gn-color-indicator')).toBeNull();
  });

  it('should find thread via review-thread testid', () => {
    const outer = document.createElement('div');
    const thread = document.createElement('div');
    thread.setAttribute('data-testid', 'review-thread');
    const commentEl = document.createElement('p');
    thread.appendChild(commentEl);
    outer.appendChild(thread);
    document.body.appendChild(outer);

    colorizeCommentThread(commentEl, 0);

    // parentElement of the review-thread is `outer`
    expect(outer.style.borderLeft).toContain('3px solid');
  });
});

describe('clearCommentColorIndicators', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should remove all color indicators from the page', () => {
    const el1 = document.createElement('div');
    el1.setAttribute('data-gn-color-indicator', 'true');
    el1.style.borderLeft = '3px solid red';
    el1.style.color = 'red';

    const el2 = document.createElement('span');
    el2.setAttribute('data-gn-color-indicator', 'true');
    el2.style.color = 'blue';

    document.body.appendChild(el1);
    document.body.appendChild(el2);

    clearCommentColorIndicators();

    expect(el1.style.borderLeft).toBe('');
    expect(el1.style.color).toBe('');
    expect(el1.getAttribute('data-gn-color-indicator')).toBeNull();
    expect(el2.style.color).toBe('');
    expect(el2.getAttribute('data-gn-color-indicator')).toBeNull();
  });

  it('should be a no-op when no indicators exist', () => {
    const el = document.createElement('div');
    el.style.borderLeft = '1px solid black';
    document.body.appendChild(el);

    clearCommentColorIndicators();

    expect(el.style.borderLeft).toBe('1px solid black');
  });
});
