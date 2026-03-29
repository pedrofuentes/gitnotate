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
