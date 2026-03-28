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
      const comment = [
        '<!-- @gn {"exact":"revenue growth","start":12,"end":26} -->',
        '> 📌 **"revenue growth"** (chars 12–26)',
        '',
        'Can we add a source?',
      ].join('\n');

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      const dec = decorations[0];

      // Range should be on line 0 (default lineOffset) with start/end from metadata
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
        [
          '<!-- @gn {"exact":"hello","start":0,"end":5} -->',
          '> 📌 **"hello"** (chars 0–5)',
          '',
          'First comment',
        ].join('\n'),
        [
          '<!-- @gn {"exact":"world","start":10,"end":15} -->',
          '> 📌 **"world"** (chars 10–15)',
          '',
          'Second comment',
        ].join('\n'),
      ];

      const decorations = parseGnDecorations(comments);

      expect(decorations).toHaveLength(2);
      expect(decorations[0].range.start.character).toBe(0);
      expect(decorations[0].range.end.character).toBe(5);
      expect(decorations[1].range.start.character).toBe(10);
      expect(decorations[1].range.end.character).toBe(15);
    });

    it('should extract hover message from user comment', () => {
      const comment = [
        '<!-- @gn {"exact":"text","start":0,"end":4} -->',
        '> 📌 **"text"** (chars 0–4)',
        '',
        'This needs revision.',
      ].join('\n');

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].hoverMessage).toBe('This needs revision.');
      expect(decorations[0].commentBody).toBe(comment);
    });

    it('should handle comments with special characters', () => {
      const comment = [
        '<!-- @gn {"exact":"say \\"hello\\" <world>","start":0,"end":20} -->',
        '> 📌 **"say \\"hello\\" &lt;world&gt;"** (chars 0–20)',
        '',
        'Interesting "quote" & <tag>',
      ].join('\n');

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].range.start.character).toBe(0);
      expect(decorations[0].range.end.character).toBe(20);
      expect(decorations[0].hoverMessage).toBe('Interesting "quote" & <tag>');
    });

    it('should use lineOffset when provided', () => {
      const comment = [
        '<!-- @gn {"exact":"text","start":5,"end":9} -->',
        '> 📌 **"text"** (chars 5–9)',
        '',
        'Comment on a specific line.',
      ].join('\n');

      const decorations = parseGnDecorations([comment], 42);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].range.start.line).toBe(42);
      expect(decorations[0].range.end.line).toBe(42);
      expect(decorations[0].range.start.character).toBe(5);
      expect(decorations[0].range.end.character).toBe(9);
    });

    it('should set hover message to highlighted text when user comment is empty', () => {
      const comment = [
        '<!-- @gn {"exact":"highlighted","start":0,"end":11} -->',
        '> 📌 **"highlighted"** (chars 0–11)',
      ].join('\n');

      const decorations = parseGnDecorations([comment]);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].hoverMessage).toBe('📌 "highlighted"');
    });

    it('should filter out non-@gn comments from mixed input', () => {
      const comments = [
        'Regular comment without metadata',
        [
          '<!-- @gn {"exact":"word","start":3,"end":7} -->',
          '> 📌 **"word"** (chars 3–7)',
          '',
          'A note',
        ].join('\n'),
        'Another regular comment',
      ];

      const decorations = parseGnDecorations(comments);

      expect(decorations).toHaveLength(1);
      expect(decorations[0].hoverMessage).toBe('A note');
    });
  });
});
