import { describe, it, expect } from 'vitest';
import { findAnchor, createSelector, findAllAnchors } from '../../src/anchor/engine';
import type { TextQuoteSelector } from '../../src/schema/types';

const sampleDoc = [
  'The quick brown fox jumps over the lazy dog.',
  'A second line with some interesting text.',
  'The quick brown fox appears again in this line.',
  'Final line of the document.',
].join('\n');

describe('findAnchor', () => {
  it('should find exact text in document', () => {
    const selector: TextQuoteSelector = { exact: 'brown fox jumps' };
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.exact).toBe('brown fox jumps');
    expect(match!.start).toBe(10);
    expect(match!.end).toBe(25);
  });

  it('should return null when text not found', () => {
    const selector: TextQuoteSelector = { exact: 'nonexistent text' };
    const match = findAnchor(selector, sampleDoc);
    expect(match).toBeNull();
  });

  it('should disambiguate with prefix when text appears multiple times', () => {
    const selector: TextQuoteSelector = {
      exact: 'quick brown fox',
      prefix: 'The ',
    };
    // Both occurrences have "The " prefix, but the first one is at position 4
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.exact).toBe('quick brown fox');
    // First occurrence at offset 4
    expect(match!.start).toBe(4);
  });

  it('should disambiguate with suffix when text appears multiple times', () => {
    const selector: TextQuoteSelector = {
      exact: 'quick brown fox',
      suffix: ' appears',
    };
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    // Second occurrence (line 3)
    const expectedStart = sampleDoc.indexOf('quick brown fox', 10);
    expect(match!.start).toBe(expectedStart);
  });

  it('should disambiguate with both prefix and suffix', () => {
    const selector: TextQuoteSelector = {
      exact: 'quick brown fox',
      prefix: 'The ',
      suffix: ' jumps',
    };
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.start).toBe(4);
    expect(match!.end).toBe(19);
  });

  it('should handle prefix/suffix that dont match exactly (partial match)', () => {
    // Prefix is longer than what's available — still should score partial overlap
    const selector: TextQuoteSelector = {
      exact: 'quick brown fox',
      prefix: 'XXXXX The ',
      suffix: ' jumps over',
    };
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.start).toBe(4);
    // Confidence should be less than 1.0 since prefix doesn't fully match
    expect(match!.confidence).toBeLessThan(1.0);
    expect(match!.confidence).toBeGreaterThan(0);
  });

  it('should find text with normalized whitespace (fuzzy)', () => {
    const doc = 'function  foo(  ) {\n  return  bar;\n}';
    const selector: TextQuoteSelector = { exact: 'function foo( )' };
    const match = findAnchor(selector, doc);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeLessThan(1.0);
  });

  it('should return confidence 1.0 for unique exact match', () => {
    const selector: TextQuoteSelector = { exact: 'brown fox jumps' };
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBe(1.0);
  });

  it('should return lower confidence for fuzzy matches', () => {
    const doc = 'hello   world   test';
    const selector: TextQuoteSelector = { exact: 'hello world test' };
    const match = findAnchor(selector, doc);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeLessThan(1.0);
    expect(match!.confidence).toBeGreaterThan(0);
  });

  it('should handle empty document', () => {
    const selector: TextQuoteSelector = { exact: 'anything' };
    const match = findAnchor(selector, '');
    expect(match).toBeNull();
  });

  it('should handle selector with only exact (no prefix/suffix)', () => {
    const selector: TextQuoteSelector = { exact: 'lazy dog' };
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.exact).toBe('lazy dog');
    expect(match!.confidence).toBe(1.0);
  });
});

describe('createSelector', () => {
  it('should create selector with exact text', () => {
    const selector = createSelector(sampleDoc, 4, 19);
    expect(selector.exact).toBe('quick brown fox');
  });

  it('should include prefix context', () => {
    const selector = createSelector(sampleDoc, 4, 19);
    expect(selector.prefix).toBeDefined();
    expect(selector.prefix!.length).toBeGreaterThan(0);
    expect(sampleDoc.substring(0, 4).endsWith(selector.prefix!)).toBe(true);
  });

  it('should include suffix context', () => {
    const selector = createSelector(sampleDoc, 4, 19);
    expect(selector.suffix).toBeDefined();
    expect(selector.suffix!.length).toBeGreaterThan(0);
    expect(sampleDoc.substring(19).startsWith(selector.suffix!)).toBe(true);
  });

  it('should handle selection at start of document (no prefix)', () => {
    const selector = createSelector(sampleDoc, 0, 9);
    expect(selector.exact).toBe('The quick');
    expect(selector.prefix).toBe('');
  });

  it('should handle selection at end of document (no suffix)', () => {
    const end = sampleDoc.length;
    const start = end - 10;
    const selector = createSelector(sampleDoc, start, end);
    expect(selector.exact).toBe(sampleDoc.slice(start, end));
    expect(selector.suffix).toBe('');
  });

  it('should respect contextChars parameter', () => {
    const selector = createSelector(sampleDoc, 50, 60, 10);
    expect(selector.prefix!.length).toBeLessThanOrEqual(10);
    expect(selector.suffix!.length).toBeLessThanOrEqual(10);
  });

  it('should trim prefix/suffix to word boundaries', () => {
    // With enough context, prefix/suffix should not start/end mid-word
    const selector = createSelector(sampleDoc, 10, 25, 32);
    if (selector.prefix && selector.prefix.length > 0) {
      // Prefix should not start in the middle of a word (first char should be a word boundary)
      const prefixStart = sampleDoc.indexOf(selector.prefix);
      if (prefixStart > 0) {
        const charBefore = sampleDoc[prefixStart - 1];
        expect(charBefore === ' ' || charBefore === '\n').toBe(true);
      }
    }
  });
});

describe('findAllAnchors', () => {
  it('should find all occurrences of exact text', () => {
    const selector: TextQuoteSelector = { exact: 'quick brown fox' };
    const matches = findAllAnchors(selector, sampleDoc);
    expect(matches.length).toBe(2);
    expect(matches[0].start).toBeLessThan(matches[1].start);
  });

  it('should return empty array when not found', () => {
    const selector: TextQuoteSelector = { exact: 'does not exist' };
    const matches = findAllAnchors(selector, sampleDoc);
    expect(matches).toEqual([]);
  });

  it('should score matches by prefix/suffix alignment', () => {
    const selector: TextQuoteSelector = {
      exact: 'quick brown fox',
      prefix: 'The ',
      suffix: ' jumps',
    };
    const matches = findAllAnchors(selector, sampleDoc);
    expect(matches.length).toBe(2);
    // First match has " jumps" suffix → higher confidence
    const first = matches.find((m) => m.start === 4)!;
    const second = matches.find((m) => m.start !== 4)!;
    expect(first.confidence).toBeGreaterThan(second.confidence);
  });
});

describe('round-trip', () => {
  it('should create a selector and find it back', () => {
    const start = 10;
    const end = 25;
    const selector = createSelector(sampleDoc, start, end);
    const match = findAnchor(selector, sampleDoc);
    expect(match).not.toBeNull();
    expect(match!.start).toBe(start);
    expect(match!.end).toBe(end);
    expect(match!.exact).toBe(sampleDoc.slice(start, end));
  });

  it('should find anchor even after text is inserted before the selection', () => {
    const start = 10;
    const end = 25;
    const selector = createSelector(sampleDoc, start, end);

    // Insert text before the selection
    const modifiedDoc = 'INSERTED TEXT ' + sampleDoc;
    const match = findAnchor(selector, modifiedDoc);
    expect(match).not.toBeNull();
    expect(match!.exact).toBe(sampleDoc.slice(start, end));
    // Offset should shift by the inserted length
    expect(match!.start).toBe(start + 'INSERTED TEXT '.length);
  });

  it('should find anchor even after text is inserted after the selection', () => {
    const start = 10;
    const end = 25;
    const selector = createSelector(sampleDoc, start, end);

    // Insert text after the selection
    const modifiedDoc =
      sampleDoc.slice(0, 30) + ' EXTRA TEXT ' + sampleDoc.slice(30);
    const match = findAnchor(selector, modifiedDoc);
    expect(match).not.toBeNull();
    expect(match!.exact).toBe(sampleDoc.slice(start, end));
    expect(match!.start).toBe(start);
  });
});
