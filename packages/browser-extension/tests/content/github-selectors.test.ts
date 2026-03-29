import { describe, it, expect } from 'vitest';
import {
  GITHUB_SELECTORS,
  queryBySelector,
} from '../../src/content/github-selectors';

describe('GITHUB_SELECTORS', () => {
  it('should export authorLink selectors', () => {
    expect(GITHUB_SELECTORS.authorLink).toBeDefined();
    expect(Array.isArray(GITHUB_SELECTORS.authorLink)).toBe(true);
    expect(GITHUB_SELECTORS.authorLink.length).toBeGreaterThan(0);
  });

  it('should export threadHeading selectors', () => {
    expect(GITHUB_SELECTORS.threadHeading).toBeDefined();
    expect(Array.isArray(GITHUB_SELECTORS.threadHeading)).toBe(true);
    expect(GITHUB_SELECTORS.threadHeading.length).toBeGreaterThan(0);
  });

  it('should export threadContainer selectors', () => {
    expect(GITHUB_SELECTORS.threadContainer).toBeDefined();
    expect(Array.isArray(GITHUB_SELECTORS.threadContainer)).toBe(true);
    expect(GITHUB_SELECTORS.threadContainer.length).toBeGreaterThan(0);
  });

  it('should include hash-resilient partial-match fallbacks for authorLink', () => {
    const hasPartialMatch = GITHUB_SELECTORS.authorLink.some(
      (s) => s.includes('[class*="') && s.includes('ActivityHeader-module__AuthorName'),
    );
    expect(hasPartialMatch).toBe(true);
  });

  it('should include a structural data-attribute fallback for authorLink', () => {
    const hasStructuralFallback = GITHUB_SELECTORS.authorLink.some(
      (s) => s.includes('data-hovercard-type'),
    );
    expect(hasStructuralFallback).toBe(true);
  });

  it('should include hash-resilient partial-match fallbacks for threadHeading', () => {
    const hasInlineReviewPartial = GITHUB_SELECTORS.threadHeading.some(
      (s) => s.includes('[class*="') && s.includes('InlineReviewThread-module__inlineReviewThreadHeading'),
    );
    const hasHeadingPartial = GITHUB_SELECTORS.threadHeading.some(
      (s) => s.includes('[class*="') && s.includes('prc-Heading-Heading'),
    );
    expect(hasInlineReviewPartial).toBe(true);
    expect(hasHeadingPartial).toBe(true);
  });
});

describe('queryBySelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return the first matching element from a list of selectors', () => {
    const el = document.createElement('a');
    el.setAttribute('data-testid', 'avatar-link');
    document.body.appendChild(el);

    const result = queryBySelector(document.body, GITHUB_SELECTORS.authorLink);
    expect(result).toBe(el);
  });

  it('should try fallback selectors when first does not match', () => {
    // Use the second selector pattern
    const el = document.createElement('span');
    el.className = 'ActivityHeader-module__AuthorName__VJr9h';
    document.body.appendChild(el);

    const result = queryBySelector(document.body, GITHUB_SELECTORS.authorLink);
    expect(result).toBe(el);
  });

  it('should return null when no selectors match', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const result = queryBySelector(document.body, GITHUB_SELECTORS.authorLink);
    expect(result).toBeNull();
  });

  it('should scope search to the provided parent element', () => {
    const parent = document.createElement('div');
    const child = document.createElement('a');
    child.setAttribute('data-testid', 'avatar-link');
    parent.appendChild(child);

    // Not in parent: should not be found when scoping differently
    const outsider = document.createElement('a');
    outsider.setAttribute('data-testid', 'avatar-link');
    document.body.appendChild(outsider);
    document.body.appendChild(parent);

    const result = queryBySelector(parent, GITHUB_SELECTORS.authorLink);
    expect(result).toBe(child);
  });
});

describe('queryBySelector — hash-resilient fallbacks', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('authorLink', () => {
    it('should match when GitHub changes the author name class hash', () => {
      // Simulate GitHub deploying a new hash for ActivityHeader-module__AuthorName
      const el = document.createElement('span');
      el.className = 'ActivityHeader-module__AuthorName__x9Kz2';
      document.body.appendChild(el);

      const result = queryBySelector(document.body, GITHUB_SELECTORS.authorLink);
      expect(result).toBe(el);
    });

    it('should match via data-hovercard-type structural fallback', () => {
      const el = document.createElement('a');
      el.setAttribute('data-hovercard-type', 'user');
      document.body.appendChild(el);

      const result = queryBySelector(document.body, GITHUB_SELECTORS.authorLink);
      expect(result).toBe(el);
    });

    it('should prefer primary selector over fallback when both present', () => {
      const primary = document.createElement('a');
      primary.setAttribute('data-testid', 'avatar-link');
      document.body.appendChild(primary);

      const fallback = document.createElement('a');
      fallback.setAttribute('data-hovercard-type', 'user');
      document.body.appendChild(fallback);

      const result = queryBySelector(document.body, GITHUB_SELECTORS.authorLink);
      expect(result).toBe(primary);
    });
  });

  describe('threadHeading', () => {
    it('should match when GitHub changes the inline review thread heading hash', () => {
      const el = document.createElement('div');
      el.className = 'InlineReviewThread-module__inlineReviewThreadHeading__Abc12';
      document.body.appendChild(el);

      const result = queryBySelector(document.body, GITHUB_SELECTORS.threadHeading);
      expect(result).toBe(el);
    });

    it('should match when GitHub changes the prc-Heading hash', () => {
      const el = document.createElement('h4');
      el.className = 'prc-Heading-Heading-Zy3Qw';
      document.body.appendChild(el);

      const result = queryBySelector(document.body, GITHUB_SELECTORS.threadHeading);
      expect(result).toBe(el);
    });

    it('should prefer primary selector over fallback when both present', () => {
      const primary = document.createElement('div');
      primary.className = 'InlineReviewThread-module__inlineReviewThreadHeading__o7jqD';
      document.body.appendChild(primary);

      const fallback = document.createElement('div');
      fallback.className = 'InlineReviewThread-module__inlineReviewThreadHeading__NewHash';
      document.body.appendChild(fallback);

      const result = queryBySelector(document.body, GITHUB_SELECTORS.threadHeading);
      expect(result).toBe(primary);
    });
  });
});
