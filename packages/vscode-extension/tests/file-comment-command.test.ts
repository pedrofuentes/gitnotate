import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock modules before importing them
vi.mock('../src/sidecar-provider', () => ({
  readLocalSidecar: vi.fn(),
  writeLocalSidecar: vi.fn(),
}));

vi.mock('@gitnotate/core', () => ({
  createSelector: vi.fn(),
  createSidecarFile: vi.fn(),
  addAnnotation: vi.fn(),
}));

import {
  window,
  Range,
  __setActiveTextEditor,
  __setWorkspaceFolders,
  __reset,
} from '../__mocks__/vscode';
import { addFileCommentCommand } from '../src/file-comment-command';
import { readLocalSidecar, writeLocalSidecar } from '../src/sidecar-provider';
import { createSelector, createSidecarFile, addAnnotation } from '@gitnotate/core';

const mockReadLocalSidecar = vi.mocked(readLocalSidecar);
const mockWriteLocalSidecar = vi.mocked(writeLocalSidecar);
const mockCreateSelector = vi.mocked(createSelector);
const mockCreateSidecarFile = vi.mocked(createSidecarFile);
const mockAddAnnotation = vi.mocked(addAnnotation);

describe('addFileCommentCommand', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    __setWorkspaceFolders([{ uri: { fsPath: '/project' } }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show error if no selection', async () => {
    __setActiveTextEditor({
      selection: new Range(5, 0, 5, 0), // empty selection
      document: {
        getText: vi.fn().mockReturnValue(''),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
        offsetAt: vi.fn().mockReturnValue(0),
      },
    });

    await addFileCommentCommand();

    expect(window.showInformationMessage).toHaveBeenCalledWith('Select text first');
    expect(window.showInputBox).not.toHaveBeenCalled();
    expect(mockCreateSelector).not.toHaveBeenCalled();
    expect(mockReadLocalSidecar).not.toHaveBeenCalled();
    expect(mockWriteLocalSidecar).not.toHaveBeenCalled();
    expect(mockAddAnnotation).not.toHaveBeenCalled();
  });

  it('should show error if no active editor', async () => {
    __setActiveTextEditor(undefined);

    await addFileCommentCommand();

    expect(window.showInformationMessage).toHaveBeenCalledWith('Select text first');
    expect(window.showInputBox).not.toHaveBeenCalled();
    expect(mockCreateSelector).not.toHaveBeenCalled();
    expect(mockReadLocalSidecar).not.toHaveBeenCalled();
    expect(mockWriteLocalSidecar).not.toHaveBeenCalled();
    expect(mockAddAnnotation).not.toHaveBeenCalled();
  });

  it('should use anchor engine for text selector creation', async () => {
    const documentText = 'const x = 42;\nconst y = 99;\n';
    const selection = new Range(0, 6, 0, 12);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue(documentText),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
        offsetAt: vi.fn((pos: { line: number; character: number }) => {
          if (pos.line === 0 && pos.character === 6) return 6;
          if (pos.line === 0 && pos.character === 12) return 12;
          return 0;
        }),
      },
    });

    const mockSelector = { exact: 'x = 42', prefix: 'const ', suffix: ';\n' };
    mockCreateSelector.mockReturnValue(mockSelector);
    mockReadLocalSidecar.mockResolvedValue(null);
    mockCreateSidecarFile.mockReturnValue({
      $schema: 'https://gitnotate.dev/schema/v1',
      version: '1.0',
      file: 'src/file.ts',
      annotations: [],
    } as any);
    mockAddAnnotation.mockReturnValue({
      $schema: 'https://gitnotate.dev/schema/v1',
      version: '1.0',
      file: 'src/file.ts',
      annotations: [{ id: '1', target: mockSelector, body: 'test' }],
    } as any);
    window.showInputBox.mockResolvedValue('Nice code!');

    await addFileCommentCommand();

    expect(mockCreateSelector).toHaveBeenCalledWith(documentText, 6, 12);
  });

  it('should add comment to sidecar file from selection', async () => {
    const documentText = 'function hello() { return "world"; }\n';
    const selection = new Range(0, 9, 0, 14);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue(documentText),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
        offsetAt: vi.fn((pos: { line: number; character: number }) => {
          if (pos.line === 0 && pos.character === 9) return 9;
          if (pos.line === 0 && pos.character === 14) return 14;
          return 0;
        }),
      },
    });

    const existingSidecar = {
      $schema: 'https://gitnotate.dev/schema/v1',
      version: '1.0' as const,
      file: 'src/file.ts',
      annotations: [],
    };
    const mockSelector = { exact: 'hello', prefix: 'function ', suffix: '() {' };
    const updatedSidecar = {
      ...existingSidecar,
      annotations: [{ id: '1', target: mockSelector, body: 'Great function!', author: { github: 'local-user' } }],
    };

    mockReadLocalSidecar.mockResolvedValue(existingSidecar);
    mockCreateSelector.mockReturnValue(mockSelector);
    mockAddAnnotation.mockReturnValue(updatedSidecar as any);
    window.showInputBox.mockResolvedValue('Great function!');

    await addFileCommentCommand();

    expect(mockReadLocalSidecar).toHaveBeenCalledWith('/project/src/file.ts');
    expect(mockAddAnnotation).toHaveBeenCalledWith(existingSidecar, {
      target: mockSelector,
      author: { github: 'local-user' },
      body: 'Great function!',
    });
    expect(mockWriteLocalSidecar).toHaveBeenCalledWith(
      '/project/src/file.ts',
      updatedSidecar
    );
    expect(window.showInformationMessage).toHaveBeenCalledWith('File comment added!');
  });

  it('should create new sidecar file if none exists', async () => {
    const documentText = 'let value = true;\n';
    const selection = new Range(0, 4, 0, 9);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue(documentText),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
        offsetAt: vi.fn((pos: { line: number; character: number }) => {
          if (pos.line === 0 && pos.character === 4) return 4;
          if (pos.line === 0 && pos.character === 9) return 9;
          return 0;
        }),
      },
    });

    const freshSidecar = {
      $schema: 'https://gitnotate.dev/schema/v1',
      version: '1.0' as const,
      file: 'src/file.ts',
      annotations: [],
    };
    const mockSelector = { exact: 'value', prefix: 'let ', suffix: ' = true' };
    const updatedSidecar = {
      ...freshSidecar,
      annotations: [{ id: '1', target: mockSelector, body: 'Good name', author: { github: 'local-user' } }],
    };

    mockReadLocalSidecar.mockResolvedValue(null);
    mockCreateSidecarFile.mockReturnValue(freshSidecar);
    mockCreateSelector.mockReturnValue(mockSelector);
    mockAddAnnotation.mockReturnValue(updatedSidecar as any);
    window.showInputBox.mockResolvedValue('Good name');

    await addFileCommentCommand();

    expect(mockCreateSidecarFile).toHaveBeenCalledWith('src/file.ts');
    expect(mockAddAnnotation).toHaveBeenCalledWith(freshSidecar, {
      target: mockSelector,
      author: { github: 'local-user' },
      body: 'Good name',
    });
    expect(mockWriteLocalSidecar).toHaveBeenCalledWith(
      '/project/src/file.ts',
      updatedSidecar
    );
  });

  it('should do nothing when user cancels input box', async () => {
    const selection = new Range(0, 0, 0, 5);
    __setActiveTextEditor({
      selection,
      document: {
        getText: vi.fn().mockReturnValue('hello world'),
        uri: { fsPath: '/project/src/file.ts' },
        fileName: '/project/src/file.ts',
        offsetAt: vi.fn().mockReturnValue(0),
      },
    });

    window.showInputBox.mockResolvedValue(undefined);

    await addFileCommentCommand();

    expect(mockReadLocalSidecar).not.toHaveBeenCalled();
    expect(mockWriteLocalSidecar).not.toHaveBeenCalled();
    expect(mockCreateSelector).not.toHaveBeenCalled();
    expect(mockAddAnnotation).not.toHaveBeenCalled();
  });
});
