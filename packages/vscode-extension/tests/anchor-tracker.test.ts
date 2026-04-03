import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspace, Range, Uri, __reset } from '../__mocks__/vscode';
import { AnchorTracker } from '../src/anchor-tracker';

function captureChangeListener(): (event: unknown) => void {
  const mock = workspace.onDidChangeTextDocument as ReturnType<typeof vi.fn>;
  return mock.mock.calls[mock.mock.calls.length - 1][0] as (event: unknown) => void;
}

function makeThread(line: number, startChar = 0, endChar = 0) {
  return {
    range: new Range(line, startChar, line, endChar),
  } as unknown as import('vscode').CommentThread;
}

function makeChangeEvent(
  uri: InstanceType<typeof Uri>,
  changes: Array<{
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
    text: string;
  }>
) {
  return {
    document: { uri },
    contentChanges: changes.map((c) => ({
      range: new Range(c.startLine, c.startChar, c.endLine, c.endChar),
      text: c.text,
      rangeLength: 0,
      rangeOffset: 0,
    })),
  };
}

describe('AnchorTracker', () => {
  let tracker: AnchorTracker;
  let fireChange: (event: unknown) => void;

  beforeEach(() => {
    __reset();
    tracker = new AnchorTracker();
    tracker.activate();
    fireChange = captureChangeListener();
  });

  it('should shift a tracked thread down by 1 when a line is inserted above it', () => {
    const uri = Uri.file('/test.md');
    const thread = makeThread(10);
    tracker.registerThread(uri, 10, thread);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 5, startChar: 0, endLine: 5, endChar: 0, text: 'new line\n' },
      ])
    );

    expect(thread.range).toEqual(new Range(11, 0, 11, 0));
  });

  it('should shift a tracked thread up by 1 when a line is deleted above it', () => {
    const uri = Uri.file('/test.md');
    const thread = makeThread(10);
    tracker.registerThread(uri, 10, thread);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 5, startChar: 0, endLine: 6, endChar: 0, text: '' },
      ])
    );

    expect(thread.range).toEqual(new Range(9, 0, 9, 0));
  });

  it('should shift a tracked thread down by 3 when 3 lines are inserted above', () => {
    const uri = Uri.file('/test.md');
    const thread = makeThread(10);
    tracker.registerThread(uri, 10, thread);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 5, startChar: 0, endLine: 5, endChar: 0, text: 'line1\nline2\nline3\n' },
      ])
    );

    expect(thread.range).toEqual(new Range(13, 0, 13, 0));
  });

  it('should not shift when text is edited within a line (no newlines added or removed)', () => {
    const uri = Uri.file('/test.md');
    const thread = makeThread(10);
    tracker.registerThread(uri, 10, thread);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 5, startChar: 0, endLine: 5, endChar: 5, text: 'hello' },
      ])
    );

    expect(thread.range).toEqual(new Range(10, 0, 10, 0));
  });

  it('should not shift a thread when the change is below it', () => {
    const uri = Uri.file('/test.md');
    const thread = makeThread(10);
    tracker.registerThread(uri, 10, thread);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 15, startChar: 0, endLine: 15, endChar: 0, text: 'new line\n' },
      ])
    );

    expect(thread.range).toEqual(new Range(10, 0, 10, 0));
  });

  it('should not shift a thread when the change is at the same line', () => {
    const uri = Uri.file('/test.md');
    const thread = makeThread(10);
    tracker.registerThread(uri, 10, thread);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 10, startChar: 0, endLine: 10, endChar: 0, text: 'new line\n' },
      ])
    );

    expect(thread.range).toEqual(new Range(10, 0, 10, 0));
  });

  it('should only shift threads below the change when multiple threads exist', () => {
    const uri = Uri.file('/test.md');
    const thread1 = makeThread(3);
    const thread2 = makeThread(8);
    const thread3 = makeThread(15);

    tracker.registerThread(uri, 3, thread1);
    tracker.registerThread(uri, 8, thread2);
    tracker.registerThread(uri, 15, thread3);

    fireChange(
      makeChangeEvent(uri, [
        { startLine: 5, startChar: 0, endLine: 5, endChar: 0, text: 'new line\n' },
      ])
    );

    expect(thread1.range).toEqual(new Range(3, 0, 3, 0));
    expect(thread2.range).toEqual(new Range(9, 0, 9, 0));
    expect(thread3.range).toEqual(new Range(16, 0, 16, 0));
  });

  it('should clear all tracked threads for a URI via reset()', () => {
    const uri = Uri.file('/test.md');
    tracker.registerThread(uri, 5, makeThread(5));
    tracker.registerThread(uri, 10, makeThread(10));

    expect(tracker.getAnchorCount(uri)).toBe(2);

    tracker.reset(uri);

    expect(tracker.getAnchorCount(uri)).toBe(0);
  });

  it('should clear all tracked threads via resetAll()', () => {
    const uri1 = Uri.file('/test1.md');
    const uri2 = Uri.file('/test2.md');

    tracker.registerThread(uri1, 5, makeThread(5));
    tracker.registerThread(uri2, 10, makeThread(10));

    tracker.resetAll();

    expect(tracker.getAnchorCount(uri1)).toBe(0);
    expect(tracker.getAnchorCount(uri2)).toBe(0);
  });

  it('should remove a specific thread via unregisterThread()', () => {
    const uri = Uri.file('/test.md');
    const thread1 = makeThread(5);
    const thread2 = makeThread(10);

    tracker.registerThread(uri, 5, thread1);
    tracker.registerThread(uri, 10, thread2);

    expect(tracker.getAnchorCount(uri)).toBe(2);

    tracker.unregisterThread(uri, thread1);

    expect(tracker.getAnchorCount(uri)).toBe(1);
  });

  it('should clear anchors and unsubscribe from events via dispose()', () => {
    const uri = Uri.file('/test.md');
    tracker.registerThread(uri, 5, makeThread(5));

    tracker.dispose();

    expect(tracker.getAnchorCount(uri)).toBe(0);

    const mock = workspace.onDidChangeTextDocument as ReturnType<typeof vi.fn>;
    const disposable = mock.mock.results[0].value;
    expect(disposable.dispose).toHaveBeenCalled();
  });

  it('should return correct count via getAnchorCount()', () => {
    const uri = Uri.file('/test.md');

    expect(tracker.getAnchorCount(uri)).toBe(0);

    tracker.registerThread(uri, 5, makeThread(5));
    expect(tracker.getAnchorCount(uri)).toBe(1);

    tracker.registerThread(uri, 10, makeThread(10));
    expect(tracker.getAnchorCount(uri)).toBe(2);
  });
});
