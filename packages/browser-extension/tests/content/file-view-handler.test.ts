import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { GitHubPageInfo } from '../../src/content/detector';
import type { SidecarFile, Annotation } from '@gitnotate/core';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../src/content/sidecar-client', () => ({
  readSidecarFile: vi.fn(),
  writeSidecarFile: vi.fn(),
}));

vi.mock('@gitnotate/core', () => ({
  findAnchor: vi.fn(),
  createSelector: vi.fn(),
  addAnnotation: vi.fn(),
  createSidecarFile: vi.fn(),
}));

vi.mock('../../src/content/highlighter', () => ({
  highlightTextRange: vi.fn(),
  clearAllHighlights: vi.fn(),
}));

vi.mock('../../src/content/ui/float-button', () => ({
  showFloatButton: vi.fn(),
  hideFloatButton: vi.fn(),
}));

vi.mock('../../src/content/ui/comment-form', () => ({
  showCommentForm: vi.fn(),
  hideCommentForm: vi.fn(),
}));

import { initFileViewComments } from '../../src/content/file-view-handler';
import { readSidecarFile, writeSidecarFile } from '../../src/content/sidecar-client';
import { findAnchor, createSelector, addAnnotation, createSidecarFile } from '@gitnotate/core';
import { highlightTextRange, clearAllHighlights } from '../../src/content/highlighter';
import { showFloatButton, hideFloatButton } from '../../src/content/ui/float-button';
import { showCommentForm, hideCommentForm } from '../../src/content/ui/comment-form';

// ── Helpers ──────────────────────────────────────────────────────────

function makePageInfo(overrides: Partial<GitHubPageInfo> = {}): GitHubPageInfo {
  return {
    type: 'file-view',
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
    filePath: 'src/utils.ts',
    ...overrides,
  };
}

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann-1',
    target: { exact: 'hello world', prefix: 'say ', suffix: ' today' },
    author: { github: 'alice' },
    body: 'Nice text',
    created: '2024-01-01T00:00:00Z',
    resolved: false,
    replies: [],
    ...overrides,
  };
}

function makeSidecarFile(annotations: Annotation[] = []): SidecarFile {
  return {
    $schema: 'https://gitnotate.dev/schemas/sidecar-v1.json',
    version: '1.0',
    file: 'src/utils.ts',
    annotations,
  };
}

/** Build a minimal file-view DOM with `.blob-wrapper` containing code lines. */
function buildFileViewDOM(lines: string[]): void {
  document.body.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'blob-wrapper';

  const table = document.createElement('table');
  table.className = 'highlight';

  for (let i = 0; i < lines.length; i++) {
    const tr = document.createElement('tr');

    const lineNumTd = document.createElement('td');
    lineNumTd.className = 'blob-num';
    lineNumTd.setAttribute('data-line-number', String(i + 1));
    tr.appendChild(lineNumTd);

    const codeTd = document.createElement('td');
    codeTd.className = 'blob-code';
    const codeInner = document.createElement('span');
    codeInner.className = 'blob-code-inner';
    codeInner.textContent = lines[i];
    codeTd.appendChild(codeInner);
    tr.appendChild(codeTd);

    table.appendChild(tr);
  }

  wrapper.appendChild(table);
  document.body.appendChild(wrapper);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('initFileViewComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should initialize for file-view pages and read the sidecar file', async () => {
    buildFileViewDOM(['const x = 1;']);
    (readSidecarFile as Mock).mockResolvedValue(null);

    await initFileViewComments(makePageInfo());

    expect(readSidecarFile).toHaveBeenCalledWith(
      'test-owner',
      'test-repo',
      'src/utils.ts',
      'main',
    );
  });

  it('should read and highlight sidecar annotations', async () => {
    const ann = makeAnnotation();
    const sidecar = makeSidecarFile([ann]);
    buildFileViewDOM(['say hello world today']);

    (readSidecarFile as Mock).mockResolvedValue(sidecar);
    (findAnchor as Mock).mockReturnValue({
      start: 4,
      end: 15,
      exact: 'hello world',
      confidence: 1.0,
    });

    await initFileViewComments(makePageInfo());

    expect(findAnchor).toHaveBeenCalledWith(
      ann.target,
      expect.any(String),
    );
    expect(highlightTextRange).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: 'ann-1',
        start: expect.any(Number),
        end: expect.any(Number),
      }),
    );
  });

  it('should handle missing sidecar file gracefully', async () => {
    buildFileViewDOM(['const x = 1;']);
    (readSidecarFile as Mock).mockResolvedValue(null);

    // Should not throw
    await expect(initFileViewComments(makePageInfo())).resolves.not.toThrow();

    expect(findAnchor).not.toHaveBeenCalled();
    expect(highlightTextRange).not.toHaveBeenCalled();
  });

  it('should skip annotations where findAnchor returns null', async () => {
    const ann = makeAnnotation();
    const sidecar = makeSidecarFile([ann]);
    buildFileViewDOM(['unrelated code']);

    (readSidecarFile as Mock).mockResolvedValue(sidecar);
    (findAnchor as Mock).mockReturnValue(null);

    await initFileViewComments(makePageInfo());

    expect(findAnchor).toHaveBeenCalled();
    expect(highlightTextRange).not.toHaveBeenCalled();
  });

  it('should enable comment creation flow via mouseup on file content', async () => {
    buildFileViewDOM(['say hello world today']);
    (readSidecarFile as Mock).mockResolvedValue(null);

    await initFileViewComments(makePageInfo());

    // Simulate a mouseup inside the blob-wrapper
    const wrapper = document.querySelector('.blob-wrapper')!;
    const codeInner = wrapper.querySelector('.blob-code-inner')!;

    // Create a text selection within the code element
    const range = document.createRange();
    range.setStart(codeInner.firstChild!, 4);
    range.setEnd(codeInner.firstChild!, 15);

    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    // Fire mouseup and wait for the setTimeout
    const mouseupEvent = new MouseEvent('mouseup', { bubbles: true });
    wrapper.dispatchEvent(mouseupEvent);
    await new Promise((r) => setTimeout(r, 50));

    expect(showFloatButton).toHaveBeenCalled();
  });

  it('should not show float button when selection is outside file content', async () => {
    buildFileViewDOM(['say hello world today']);
    (readSidecarFile as Mock).mockResolvedValue(null);

    await initFileViewComments(makePageInfo());

    // Create an element outside the blob-wrapper
    const outside = document.createElement('div');
    outside.textContent = 'outside content';
    document.body.appendChild(outside);

    // Clear any selection
    window.getSelection()?.removeAllRanges();

    const mouseupEvent = new MouseEvent('mouseup', { bubbles: true });
    outside.dispatchEvent(mouseupEvent);
    await new Promise((r) => setTimeout(r, 50));

    expect(showFloatButton).not.toHaveBeenCalled();
  });

  it('should stop listening for mouseup after signal is aborted', async () => {
    buildFileViewDOM(['say hello world today']);
    (readSidecarFile as Mock).mockResolvedValue(null);

    const controller = new AbortController();
    await initFileViewComments(makePageInfo(), { signal: controller.signal });

    const selectAndMouseup = async () => {
      const codeInner = document.querySelector('.blob-code-inner')!;
      const range = document.createRange();
      range.setStart(codeInner.firstChild!, 4);
      range.setEnd(codeInner.firstChild!, 15);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.querySelector('.blob-wrapper')!.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true }),
      );
      await new Promise((r) => setTimeout(r, 50));
    };

    // Before abort: our listener is active and contributes one call
    (showFloatButton as Mock).mockClear();
    await selectAndMouseup();
    const callsBeforeAbort = (showFloatButton as Mock).mock.calls.length;

    // Abort — removes our mouseup listener
    controller.abort();

    // After abort: our listener no longer fires, one fewer call
    (showFloatButton as Mock).mockClear();
    await selectAndMouseup();
    const callsAfterAbort = (showFloatButton as Mock).mock.calls.length;

    expect(callsAfterAbort).toBe(callsBeforeAbort - 1);
  });

  it('should wire float button click to show comment form', async () => {
    buildFileViewDOM(['say hello world today']);
    (readSidecarFile as Mock).mockResolvedValue(null);

    // Capture the onComment callback passed to showFloatButton
    let capturedOnComment: ((info: unknown) => void) | undefined;
    (showFloatButton as Mock).mockImplementation((_info: unknown, onComment: (info: unknown) => void) => {
      capturedOnComment = onComment;
      return document.createElement('button');
    });

    await initFileViewComments(makePageInfo());

    // Trigger selection + mouseup
    const codeInner = document.querySelector('.blob-code-inner')!;
    const range = document.createRange();
    range.setStart(codeInner.firstChild!, 4);
    range.setEnd(codeInner.firstChild!, 15);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    const mouseupEvent = new MouseEvent('mouseup', { bubbles: true });
    document.querySelector('.blob-wrapper')!.dispatchEvent(mouseupEvent);
    await new Promise((r) => setTimeout(r, 50));

    expect(capturedOnComment).toBeDefined();

    // Simulate clicking the float button
    const fakeSelectionInfo = { exact: 'hello world', start: 4, end: 15 };
    capturedOnComment!(fakeSelectionInfo);

    expect(hideFloatButton).toHaveBeenCalled();
    expect(showCommentForm).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionInfo: fakeSelectionInfo,
        onSubmit: expect.any(Function),
        onCancel: expect.any(Function),
      }),
    );
  });

  it('should persist annotation on comment submit', async () => {
    const existingSidecar = makeSidecarFile([]);
    buildFileViewDOM(['say hello world today']);

    (readSidecarFile as Mock).mockResolvedValue(existingSidecar);
    (createSelector as Mock).mockReturnValue({
      exact: 'hello world',
      prefix: 'say ',
      suffix: ' today',
    });
    const updatedSidecar = makeSidecarFile([makeAnnotation()]);
    (addAnnotation as Mock).mockReturnValue(updatedSidecar);
    (writeSidecarFile as Mock).mockResolvedValue(true);

    // Capture the onSubmit from showCommentForm
    let capturedOnSubmit: ((comment: string) => Promise<void>) | undefined;
    (showCommentForm as Mock).mockImplementation((opts: { onSubmit: (comment: string) => Promise<void> }) => {
      capturedOnSubmit = opts.onSubmit;
      return document.createElement('div');
    });

    // Capture onComment from showFloatButton
    let capturedOnComment: ((info: unknown) => void) | undefined;
    (showFloatButton as Mock).mockImplementation((_info: unknown, onComment: (info: unknown) => void) => {
      capturedOnComment = onComment;
      return document.createElement('button');
    });

    await initFileViewComments(makePageInfo());

    // Trigger selection + mouseup
    const codeInner = document.querySelector('.blob-code-inner')!;
    const range = document.createRange();
    range.setStart(codeInner.firstChild!, 4);
    range.setEnd(codeInner.firstChild!, 15);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    document.querySelector('.blob-wrapper')!.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 50));

    // Click float button
    capturedOnComment!({
      exact: 'hello world',
      start: 4,
      end: 15,
      lineNumber: 1,
      filePath: 'src/utils.ts',
      side: 'RIGHT' as const,
      lineElement: codeInner,
    });

    // Submit comment
    expect(capturedOnSubmit).toBeDefined();
    await capturedOnSubmit!('Great code!');

    expect(createSelector).toHaveBeenCalled();
    expect(addAnnotation).toHaveBeenCalled();
    expect(writeSidecarFile).toHaveBeenCalledWith(
      'test-owner',
      'test-repo',
      'src/utils.ts',
      updatedSidecar,
      expect.any(String),
    );
  });
});
