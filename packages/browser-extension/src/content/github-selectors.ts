/**
 * GitHub-specific CSS selectors used throughout the extension.
 *
 * These selectors target GitHub's internal CSS class names which are
 * generated/hashed and may change across deployments. Centralizing
 * them here makes updates easier and enables graceful fallback via
 * the `queryBySelector` helper.
 *
 * ## Hashed selectors & maintenance
 *
 * GitHub uses CSS Modules with a naming pattern:
 *   `ModuleName-module__styleName__<hash>`
 *
 * The `<hash>` suffix changes on every GitHub deploy. When that
 * happens the exact-match selectors (e.g.
 * `.ActivityHeader-module__AuthorName__VJr9h`) will stop matching.
 *
 * To mitigate this each group contains:
 *   1. **Primary selectors** — exact hashed class names (fastest, but brittle)
 *   2. **Partial-match fallbacks** — `[class*="Module__Style"]` patterns that
 *      survive hash changes
 *   3. **Structural fallbacks** — data-attributes or semantic HTML that are
 *      unlikely to change
 *
 * When a primary selector breaks, update its hash here. The partial-match
 * and structural fallbacks keep the extension working in the meantime.
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
    // Data-attribute selectors — stable across deployments
    '[data-marker-id]',
    '[data-testid="review-thread"]',
    // Semantic class — reasonably stable
    '.inline-comment-form',
  ],
  authorLink: [
    // Data-attribute — stable
    '[data-testid="avatar-link"]',
    // Primary hashed class (update hash when GitHub deploys)
    '.ActivityHeader-module__AuthorName__VJr9h',
    // Partial-match fallback — survives hash changes
    '[class*="ActivityHeader-module__AuthorName"]',
    // Structural fallback — user hovercard links
    'a[data-hovercard-type="user"]',
  ],
  threadHeading: [
    // Primary hashed classes (update hashes when GitHub deploys)
    '.InlineReviewThread-module__inlineReviewThreadHeading__o7jqD',
    'h4.prc-Heading-Heading-MtWFE',
    // Partial-match fallbacks — survive hash changes
    '[class*="InlineReviewThread-module__inlineReviewThreadHeading"]',
    'h4[class*="prc-Heading-Heading"]',
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
