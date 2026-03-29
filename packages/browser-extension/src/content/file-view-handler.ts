import type { GitHubPageInfo } from './detector';
import type { TextSelectionInfo } from './selection';
import {
  findAnchor,
  createSelector,
  addAnnotation,
  createSidecarFile,
} from '@gitnotate/core';
import { readSidecarFile, writeSidecarFile } from './sidecar-client';
import { highlightTextRange, clearAllHighlights } from './highlighter';
import { showFloatButton, hideFloatButton } from './ui/float-button';
import { showCommentForm, hideCommentForm } from './ui/comment-form';
import { debug } from './logger';

/**
 * Extract the full text content of the rendered file from the DOM.
 * Handles both code files (.blob-code-inner elements) and rendered
 * markdown (.markdown-body).
 */
function getFileText(): string {
  // Code view: collect text from each blob-code-inner line
  const codeLines = document.querySelectorAll<HTMLElement>(
    '.blob-wrapper .blob-code-inner',
  );
  if (codeLines.length > 0) {
    return Array.from(codeLines)
      .map((el) => el.textContent ?? '')
      .join('\n');
  }

  // Rendered markdown fallback
  const markdown = document.querySelector<HTMLElement>('.markdown-body');
  if (markdown) {
    return markdown.textContent ?? '';
  }

  // Generic blob-wrapper fallback
  const wrapper = document.querySelector<HTMLElement>('.blob-wrapper');
  return wrapper?.textContent ?? '';
}

/**
 * Determine which line number a DOM element belongs to by walking up
 * to the containing <tr> and reading the adjacent blob-num cell.
 */
function getLineNumberForElement(el: Element): number {
  const row = el.closest('tr');
  if (!row) return 1;
  const numCell = row.querySelector<HTMLElement>('.blob-num[data-line-number]');
  if (!numCell) return 1;
  return Number(numCell.getAttribute('data-line-number')) || 1;
}

/**
 * Get selection info when the user selects text inside the file view.
 * Returns null if the selection is outside the file content area.
 */
function getFileViewSelectionInfo(
  filePath: string,
): TextSelectionInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  const container =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  if (!container) return null;

  // Must be inside the file content area
  const blobWrapper = container.closest('.blob-wrapper');
  if (!blobWrapper) return null;

  const exact = sel.toString();
  if (!exact.trim()) return null;

  // Find the code cell and compute character offsets
  const codeInner = container.closest('.blob-code-inner') ?? container.querySelector('.blob-code-inner');
  const lineElement = codeInner ?? (container as HTMLElement);
  const lineNumber = getLineNumberForElement(lineElement);

  const lineText = lineElement.textContent ?? '';
  const startOffset = lineText.indexOf(exact);
  const start = startOffset >= 0 ? startOffset : 0;
  const end = start + exact.length;

  return {
    exact,
    start,
    end,
    lineNumber,
    filePath,
    side: 'RIGHT',
    lineElement: lineElement as HTMLElement,
  };
}

/**
 * Initialise file-view annotation support.
 *
 * 1. Reads existing sidecar annotations and highlights them.
 * 2. Listens for text selections to enable new annotation creation.
 */
export async function initFileViewComments(
  pageInfo: GitHubPageInfo,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const { owner, repo, branch, filePath } = pageInfo;
  if (!filePath) return;

  debug('[Gitnotate] File-view mode for', filePath);

  // ── Load & highlight existing annotations ──────────────────────────
  let sidecar = await readSidecarFile(owner, repo, filePath, branch);
  const documentText = getFileText();

  if (sidecar) {
    clearAllHighlights();

    for (const annotation of sidecar.annotations) {
      const match = findAnchor(annotation.target, documentText);
      if (!match) continue;

      // Map character offset to a line number
      const textBefore = documentText.slice(0, match.start);
      const lineNumber = (textBefore.match(/\n/g) ?? []).length + 1;

      // Compute the start offset within that line
      const lastNewline = textBefore.lastIndexOf('\n');
      const lineStart = lastNewline >= 0 ? match.start - lastNewline - 1 : match.start;
      const lineEnd = lineStart + match.exact.length;

      highlightTextRange({
        filePath,
        lineNumber,
        side: 'R',
        start: lineStart,
        end: lineEnd,
        commentId: annotation.id,
      });
    }
  }

  // ── Text selection → float button → comment form ───────────────────
  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selInfo = getFileViewSelectionInfo(filePath);
      if (selInfo) {
        showFloatButton(selInfo, handleFloatButtonClick);
      } else {
        hideFloatButton();
      }
    }, 10);
  }, { signal: options?.signal });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      hideFloatButton();
    }
  }, { signal: options?.signal });

  function handleFloatButtonClick(selectionInfo: TextSelectionInfo): void {
    hideFloatButton();

    showCommentForm({
      selectionInfo,
      onSubmit: async (userComment: string) => {
        const currentText = getFileText();
        const selector = createSelector(
          currentText,
          selectionInfo.start,
          selectionInfo.end,
        );

        // Build updated sidecar without mutating current state
        const current = sidecar ?? createSidecarFile(filePath);
        const updated = addAnnotation(current, {
          target: selector,
          author: { github: '' },
          body: userComment,
        });

        const success = await writeSidecarFile(
          owner,
          repo,
          filePath,
          updated,
          `Add annotation on ${filePath}`,
        );

        if (!success) {
          throw new Error('Failed to save annotation. Please try again.');
        }

        // Only update in-memory state after confirmed write
        sidecar = updated;

        hideCommentForm();
      },
      onCancel: () => {
        hideCommentForm();
      },
    });
  }
}
