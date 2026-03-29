/**
 * Apply / clear colored indicators on comment thread containers to
 * visually associate them with their highlight color.
 */

import { HIGHLIGHT_COLORS } from './highlighter';

/**
 * Apply a colored left border to the comment thread container to
 * visually associate it with its highlight color.
 *
 * For submitted comments: colors the author name link.
 * For pending comment boxes: colors the "Add a comment on line" heading.
 */
export function colorizeCommentThread(commentEl: HTMLElement, colorIndex: number): void {
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
export function clearCommentColorIndicators(): void {
  const indicators = document.querySelectorAll<HTMLElement>('[data-gn-color-indicator]');
  for (const el of indicators) {
    el.style.borderLeft = '';
    el.style.color = '';
    el.removeAttribute('data-gn-color-indicator');
  }
}
