import { describe, it, expect } from 'vitest';
import { parseGnComment } from '../../src/metadata/parser';

describe('parseGnComment', () => {
  it('should parse ^gn:line:start:end format', () => {
    const result = parseGnComment('My comment\n^gn:5:R:12:47');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(5);
    expect(result!.metadata.start).toBe(12);
    expect(result!.metadata.end).toBe(47);
    expect(result!.userComment).toBe('My comment');
  });

  it('should return null for comment without ^gn tag', () => {
    expect(parseGnComment('Just a regular comment')).toBeNull();
  });

  it('should handle tag-only comment (no user text)', () => {
    const result = parseGnComment('^gn:1:R:0:10');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(1);
    expect(result!.metadata.start).toBe(0);
    expect(result!.metadata.end).toBe(10);
    expect(result!.userComment).toBe('');
  });

  it('should handle multi-line user comment with tag on last line', () => {
    const result = parseGnComment('First line.\n\nSecond paragraph.\n^gn:3:R:5:20');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(3);
    expect(result!.metadata.start).toBe(5);
    expect(result!.metadata.end).toBe(20);
    expect(result!.userComment).toBe('First line.\n\nSecond paragraph.');
  });

  it('should handle large offsets', () => {
    const result = parseGnComment('Comment\n^gn:500:R:1000:2000');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(500);
    expect(result!.metadata.start).toBe(1000);
    expect(result!.metadata.end).toBe(2000);
  });

  it('should return null for malformed tag', () => {
    expect(parseGnComment('^gn:abc:def:ghi')).toBeNull();
    expect(parseGnComment('^gn:12')).toBeNull();
    expect(parseGnComment('^gn:')).toBeNull();
    // Old 2-field format no longer supported
    expect(parseGnComment('^gn:12:47')).toBeNull();
  });

  it('should parse tag in plain text (no backticks needed)', () => {
    const result = parseGnComment('^gn:5:R:12:47');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(5);
    expect(result!.metadata.start).toBe(12);
    expect(result!.metadata.end).toBe(47);
  });

  it('should parse L-side tag with user comment', () => {
    const result = parseGnComment('Left-side comment\n^gn:8:L:3:15');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(8);
    expect(result!.metadata.side).toBe('L');
    expect(result!.metadata.start).toBe(3);
    expect(result!.metadata.end).toBe(15);
    expect(result!.userComment).toBe('Left-side comment');
  });

  it('should parse L-side tag-only comment (no user text)', () => {
    const result = parseGnComment('^gn:42:L:0:20');

    expect(result).not.toBeNull();
    expect(result!.metadata.lineNumber).toBe(42);
    expect(result!.metadata.side).toBe('L');
    expect(result!.metadata.start).toBe(0);
    expect(result!.metadata.end).toBe(20);
    expect(result!.userComment).toBe('');
  });

  it('should distinguish L-side from R-side in parsed metadata', () => {
    const left = parseGnComment('^gn:10:L:5:15');
    const right = parseGnComment('^gn:10:R:5:15');

    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.metadata.side).toBe('L');
    expect(right!.metadata.side).toBe('R');
  });
});
