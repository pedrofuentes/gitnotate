import { detectGitHubPage } from './detector';
import { observeDiffContent } from './diff-observer';
import { getSelectionInfo } from './selection';
import { showFloatButton, hideFloatButton } from './ui/float-button';

const pageInfo = detectGitHubPage();
console.log('[Gitnotate] Page detected:', pageInfo);

if (pageInfo.type === 'pr-files-changed') {
  console.log('[Gitnotate] PR diff page detected, initializing...');
  observeDiffContent((diffElements) => {
    console.log('[Gitnotate] Diff elements loaded:', diffElements.length);
    // Future: highlight @gn comments
  });

  // Listen for text selections in diff lines
  document.addEventListener('mouseup', () => {
    // Small delay to let the selection finalize
    setTimeout(() => {
      const info = getSelectionInfo();
      if (info) {
        showFloatButton(info, (selectionInfo) => {
          console.log('[Gitnotate] Comment requested:', selectionInfo);
          hideFloatButton();
        });
      } else {
        hideFloatButton();
      }
    }, 10);
  });

  // Hide button when selection is cleared
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      hideFloatButton();
    }
  });
}
