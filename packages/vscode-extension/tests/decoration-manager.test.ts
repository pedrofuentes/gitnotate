import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, window } from '../__mocks__/vscode';
import { DecorationManager } from '../src/decoration-manager';
import type { GnDecoration } from '../src/comment-decoration';
import { Range } from '../__mocks__/vscode';

function createMockContext() {
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
  } as any;
}

function createMockEditor() {
  return {
    setDecorations: vi.fn(),
    document: {
      uri: { fsPath: '/test/file.md' },
    },
  } as any;
}

function createDecoration(
  startChar: number,
  endChar: number,
  hover: string
): GnDecoration {
  return {
    range: new Range(0, startChar, 0, endChar),
    hoverMessage: hover,
    commentBody: `<!-- @gn {"exact":"text","start":${startChar},"end":${endChar}} -->\n${hover}`,
  };
}

describe('DecorationManager', () => {
  beforeEach(() => {
    __reset();
  });

  it('should apply decorations to an editor', () => {
    const context = createMockContext();
    const manager = new DecorationManager(context);
    const editor = createMockEditor();
    const decorations = [
      createDecoration(0, 5, 'First'),
      createDecoration(10, 20, 'Second'),
    ];

    manager.applyDecorations(editor, decorations);

    expect(editor.setDecorations).toHaveBeenCalledTimes(1);
    const [decorationType, ranges] = editor.setDecorations.mock.calls[0];
    expect(decorationType).toBeDefined();
    expect(ranges).toHaveLength(2);
    expect(ranges[0].range.start.character).toBe(0);
    expect(ranges[1].range.start.character).toBe(10);
  });

  it('should clear decorations', () => {
    const context = createMockContext();
    const manager = new DecorationManager(context);
    const editor = createMockEditor();

    // Apply first to create the decoration type
    manager.applyDecorations(editor, [createDecoration(0, 5, 'Test')]);

    manager.clearDecorations(editor);

    // Second call to setDecorations should have empty array
    expect(editor.setDecorations).toHaveBeenCalledTimes(2);
    const [, ranges] = editor.setDecorations.mock.calls[1];
    expect(ranges).toHaveLength(0);
  });

  it('should dispose resources', () => {
    const context = createMockContext();
    const manager = new DecorationManager(context);

    // Apply decorations to create the internal decoration type
    const editor = createMockEditor();
    manager.applyDecorations(editor, [createDecoration(0, 5, 'Test')]);

    expect(() => manager.dispose()).not.toThrow();
  });

  it('should handle null/undefined editor gracefully', () => {
    const context = createMockContext();
    const manager = new DecorationManager(context);

    expect(() =>
      manager.applyDecorations(undefined as any, [])
    ).not.toThrow();
    expect(() => manager.clearDecorations(undefined as any)).not.toThrow();
  });
});
