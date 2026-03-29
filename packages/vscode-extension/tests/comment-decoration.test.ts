import { describe, it, expect, beforeEach } from 'vitest';
import { __reset } from '../__mocks__/vscode';
import { window, Range } from '../__mocks__/vscode';
import {
  createHighlightDecorationType,
  parseGnDecorations,
} from '../src/comment-decoration';

describe('comment-decoration', () => {
  beforeEach(() => {
    __reset();
  });

  describe('createHighlightDecorationType', () => {
    it('should create decoration type with correct colors', () => {
      const decorationType = createHighlightDecorationType();

      expect(window.createTextEditorDecorationType).toHaveBeenCalledTimes(1);
      const options =
        window.createTextEditorDecorationType.mock.calls[0][0];

      expect(options.backgroundColor).toBe('rgba(255, 213, 79, 0.3)');
      expect(options.borderBottom).toBe('2px solid #f9a825');
      expect(options.cursor).toBe('pointer');
      expect(decorationType).toBeDefined();
    });
  });

  describe('parseGnDecorations', () => {
    it('should parse @gn comment and return decoration with correct range', () => {
      const comment = 'Can we add a source?\n@gn:0:12:26';

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      const dec = decorations[0];

      // Range should use lineNumber from metadata (0) with start/end offsets
      expect(dec.range).toBeInstanceOf(Range);
      expect(dec.range.start.line).toBe(0);
      expect(dec.range.start.character).toBe(12);
      expect(dec.range.end.line).toBe(0);
      expect(dec.range.end.character).toBe(26);
    });

    it('should return empty array for comments without @gn metadata', () => {
      const comment = 'This is a regular PR comment with no metadata.';

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(0);
    });

    it('should handle multiple @gn comments', () => {
      const comments = [
        'First comment\n@gn:0:0:5',
        'Second comment\n@gn:0:10:15',
      ];

      const decorations = parseGnDecorations(comments);

      expect(decorations).toHaveLength(2);
      expect(decorations[0].range.start.character).toBe(0);
      expect(decorations[0].range.end.character).toBe(5);
      expect(decorations[1].range.start.character).toBe(10);
      expect(decorations[1].range.end.character).toBe(15);
    });

    it('should extract hover message from user comment', () => {
      const comment = 'This needs revision.\n@gn:0:0:4';

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].hoverMessage).toBe('This needs revision.');
      expect(decorations[0].commentBody).toBe(comment);
    });

    it('should handle comments with special characters', () => {
      const comment = 'Interesting "quote" & <tag>\n@gn:0:0:20';

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].range.start.character).toBe(0);
      expect(decorations[0].range.end.character).toBe(20);
      expect(decorations[0].hoverMessage).toBe('Interesting "quote" & <tag>');
    });

    it('should use lineOffset when provided', () => {
      const comment = 'Comment on a specific line.\n@gn:0:5:9';

      const decorations = parseGnDecorations([comment], 42);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].range.start.line).toBe(42);
      expect(decorations[0].range.end.line).toBe(42);
      expect(decorations[0].range.start.character).toBe(5);
      expect(decorations[0].range.end.character).toBe(9);
    });

    it('should set hover message to highlighted text when user comment is empty', () => {
      const comment = '@gn:0:0:11';

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].hoverMessage).toBe('📌 ""');
    });

    it('should filter out non-@gn comments from mixed input', () => {
      const comments = [
        'Regular comment without metadata',
        'A note\n@gn:0:3:7',
        'Another regular comment',
      ];

      const decorations = parseGnDecorations(comments);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].hoverMessage).toBe('A note');
    });
  });
});
