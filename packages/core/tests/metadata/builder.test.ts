import { describe, it, expect } from 'vitest';
import { buildGnComment } from '../../src/metadata/builder';
import { parseGnComment } from '../../src/metadata/parser';
import type { GnMetadata } from '../../src/metadata/types';

describe('buildGnComment', () => {
  it('should build comment with ^gn tag including line number', () => {
    const metadata: GnMetadata = {
      exact: 'revenue growth exceeded expectations',
      lineNumber: 5,
      side: 'R',
      start: 12,
      end: 47,
    };
    const result = buildGnComment(metadata, 'Can we add the exact percentage?');

    expect(result).toBe('Can we add the exact percentage?\n^gn:5:R:12:47');
  });

  it('should return just the tag for empty user comment', () => {
    const metadata: GnMetadata = { exact: 'text', lineNumber: 1, side: 'R', start: 0, end: 4 };

    const result = buildGnComment(metadata, '');

    expect(result).toBe('^gn:1:R:0:4');
  });

  it('should handle multi-line user comments', () => {
    const metadata: GnMetadata = { exact: 'foo', lineNumber: 10, side: 'R', start: 0, end: 3 };

    const result = buildGnComment(metadata, 'First line.\n\nSecond paragraph.');

    expect(result).toBe('First line.\n\nSecond paragraph.\n^gn:10:R:0:3');
  });

  it('should produce output that parser can round-trip', () => {
    const metadata: GnMetadata = {
      exact: 'revenue growth',
      lineNumber: 5,
      side: 'R',
      start: 12,
      end: 47,
    };

    const built = buildGnComment(metadata, 'Add the exact percentage');
    const parsed = parseGnComment(built);

    expect(parsed).not.toBeNull();
    expect(parsed!.metadata.lineNumber).toBe(5);
    expect(parsed!.metadata.start).toBe(12);
    expect(parsed!.metadata.end).toBe(47);
    expect(parsed!.userComment).toBe('Add the exact percentage');
  });

  it('should handle special characters in user comment', () => {
    const metadata: GnMetadata = { exact: 'test', lineNumber: 3, side: 'R', start: 5, end: 9 };

    const result = buildGnComment(metadata, 'Check "this" & <that>');

    expect(result).toContain('Check "this" & <that>');
    expect(result).toContain('^gn:3:R:5:9');
  });

  it('should handle large offsets', () => {
    const metadata: GnMetadata = { exact: 'text', lineNumber: 500, side: 'R', start: 1000, end: 2000 };

    const result = buildGnComment(metadata, 'Comment');

    expect(result).toBe('Comment\n^gn:500:R:1000:2000');
  });

  it('should build L-side comment with ^gn tag', () => {
    const metadata: GnMetadata = {
      exact: 'old implementation',
      lineNumber: 12,
      side: 'L',
      start: 4,
      end: 22,
    };
    const result = buildGnComment(metadata, 'This was removed — good riddance');

    expect(result).toBe('This was removed — good riddance\n^gn:12:L:4:22');
  });

  it('should return just the L-side tag for empty user comment', () => {
    const metadata: GnMetadata = { exact: 'deleted', lineNumber: 3, side: 'L', start: 0, end: 7 };

    const result = buildGnComment(metadata, '');

    expect(result).toBe('^gn:3:L:0:7');
  });

  it('should round-trip L-side metadata through builder and parser', () => {
    const metadata: GnMetadata = {
      exact: 'old code',
      lineNumber: 25,
      side: 'L',
      start: 8,
      end: 16,
    };

    const built = buildGnComment(metadata, 'Why was this removed?');
    const parsed = parseGnComment(built);

    expect(parsed).not.toBeNull();
    expect(parsed!.metadata.lineNumber).toBe(25);
    expect(parsed!.metadata.side).toBe('L');
    expect(parsed!.metadata.start).toBe(8);
    expect(parsed!.metadata.end).toBe(16);
    expect(parsed!.userComment).toBe('Why was this removed?');
  });
});
