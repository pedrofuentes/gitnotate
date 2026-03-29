const DIFF_SELECTORS = ['.diff-table', '[data-diff-anchor]', '.file'] as const;
const DIFF_SELECTOR = DIFF_SELECTORS.join(', ');

function findDiffElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(DIFF_SELECTOR));
}

function containsDiffElements(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;

  if (node.matches(DIFF_SELECTOR)) return true;

  return node.querySelector(DIFF_SELECTOR) !== null;
}

export interface ObserveDiffOptions {
  signal?: AbortSignal;
}

/**
 * Watches for diff content being added to the DOM.
 * Calls `callback` with matching diff elements when they appear.
 * Also fires immediately if diff elements are already present.
 */
export function observeDiffContent(
  callback: (diffElements: HTMLElement[]) => void,
  options?: ObserveDiffOptions,
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
          if (node instanceof HTMLElement && node.matches(DIFF_SELECTOR)) {
            found.push(node);
          }
          if (node instanceof HTMLElement) {
            found.push(
              ...Array.from(node.querySelectorAll<HTMLElement>(DIFF_SELECTOR)),
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

  // Handle GitHub's turbo navigation — use signal for cleanup
  document.addEventListener('turbo:load', () => {
    const elements = findDiffElements();
    if (elements.length > 0) {
      callback(elements);
    }
  }, { signal: options?.signal });

  return observer;
}
