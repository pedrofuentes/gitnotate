/**
 * GitHub-specific CSS selectors used throughout the extension.
 *
 * These selectors target GitHub's internal CSS class names which are
 * generated/hashed and may change across deployments. Centralizing
 * them here makes updates easier and enables graceful fallback via
 * the `queryBySelector` helper.
 */

export interface GitHubSelectorGroup {
  /** Thread container selectors (outermost review thread wrapper). */
  threadContainer: string[];
  /** Author name/avatar link selectors. */
  authorLink: string[];
  /** Inline review thread heading selectors. */
  threadHeading: string[];
}

export const GITHUB_SELECTORS: GitHubSelectorGroup = {
  threadContainer: [
    '[data-marker-id]',
    '[data-testid="review-thread"]',
    '.inline-comment-form',
  ],
  authorLink: [
    '[data-testid="avatar-link"]',
    '.ActivityHeader-module__AuthorName__VJr9h',
  ],
  threadHeading: [
    '.InlineReviewThread-module__inlineReviewThreadHeading__o7jqD',
    'h4.prc-Heading-Heading-MtWFE',
  ],
};

/**
 * Query for the first element matching any selector in the list.
 * Returns null if none match — providing graceful fallback when
 * GitHub changes their class names.
 */
export function queryBySelector(
  parent: ParentNode,
  selectors: string[],
): HTMLElement | null {
  for (const selector of selectors) {
    const el = parent.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}
