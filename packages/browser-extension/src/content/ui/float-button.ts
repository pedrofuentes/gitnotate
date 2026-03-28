import type { TextSelectionInfo } from '../selection';

let currentButton: HTMLElement | null = null;

/**
 * Show a floating "Add Comment" button near the current text selection.
 * Removes any previously shown button first.
 */
export function showFloatButton(
  selectionInfo: TextSelectionInfo,
  onComment: (info: TextSelectionInfo) => void,
): HTMLElement {
  // Remove existing button
  hideFloatButton();

  const btn = document.createElement('button');
  btn.className = 'gn-float-btn';
  btn.title = 'Add Gitnotate comment';
  btn.textContent = '💬';
  btn.setAttribute('aria-label', 'Add Gitnotate comment');

  // Position near the selection
  let top = 0;
  let left = 0;

  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      top = rect.bottom + window.scrollY + 4;
      left = rect.right + window.scrollX + 4;
    }
  } catch {
    // Fallback: position near the line element
    const rect = selectionInfo.lineElement.getBoundingClientRect();
    top = rect.top + window.scrollY;
    left = rect.right + window.scrollX + 4;
  }

  btn.style.position = 'absolute';
  btn.style.top = `${top}px`;
  btn.style.left = `${left}px`;
  btn.style.zIndex = '2147483646';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onComment(selectionInfo);
  });

  document.body.appendChild(btn);
  currentButton = btn;

  return btn;
}

/**
 * Remove the floating button from the DOM (if present).
 */
export function hideFloatButton(): void {
  if (currentButton && currentButton.parentNode) {
    currentButton.parentNode.removeChild(currentButton);
  }
  currentButton = null;
}
