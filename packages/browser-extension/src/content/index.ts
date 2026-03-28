import { detectGitHubPage } from './detector';
import { observeDiffContent } from './diff-observer';

const pageInfo = detectGitHubPage();
console.log('[Gitnotate] Page detected:', pageInfo);

if (pageInfo.type === 'pr-files-changed') {
  console.log('[Gitnotate] PR diff page detected, initializing...');
  observeDiffContent((diffElements) => {
    console.log('[Gitnotate] Diff elements loaded:', diffElements.length);
    // Future: highlight @gn comments, enable text selection
  });
}
