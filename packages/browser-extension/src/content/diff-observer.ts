const DIFF_SELECTORS = ['.diff-table', '[data-diff-anchor]', '.file'] as const;

function findDiffElements(): HTMLElement[] {
  const selector = DIFF_SELECTORS.join(', ');
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

function containsDiffElements(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;

  // Check if the node itself matches
  if (node.matches(DIFF_SELECTORS.join(', '))) return true;

  // Check descendants
  return node.querySelector(DIFF_SELECTORS.join(', ')) !== null;
}

/**
 * Watches for diff content being added to the DOM.
 * Calls `callback` with matching diff elements when they appear.
 * Also fires immediately if diff elements are already present.
 */
export function observeDiffContent(
  callback: (diffElements: HTMLElement[]) => void,
): MutationObserver {
  // Fire immediately for any existing diff elements
  const existing = findDiffElements();
  if (existing.length > 0) {
    queueMicrotask(() => callback(existing));
  }

  const observer = new MutationObserver((mutations) => {
    const found: HTMLElement[] = [];

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (containsDiffElements(node)) {
          // Collect the actual diff elements (not the container)
          if (node instanceof HTMLElement && node.matches(DIFF_SELECTORS.join(', '))) {
            found.push(node);
          }
          if (node instanceof HTMLElement) {
            found.push(
              ...Array.from(node.querySelectorAll<HTMLElement>(DIFF_SELECTORS.join(', '))),
            );
          }
        }
      }
    }

    if (found.length > 0) {
      callback(found);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Handle GitHub's turbo navigation
  document.addEventListener('turbo:load', () => {
    const elements = findDiffElements();
    if (elements.length > 0) {
      callback(elements);
    }
  });

  return observer;
}
