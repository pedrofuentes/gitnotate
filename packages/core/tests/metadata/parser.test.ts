import { describe, it, expect } from 'vitest';
import { parseGnComment } from '../../src/metadata/parser';

describe('parseGnComment', () => {
  it('should parse `@gn:start:end` format', () => {
    const result = parseGnComment('My comment `@gn:12:47`');

    expect(result).not.toBeNull();
    expect(result!.metadata.start).toBe(12);
    expect(result!.metadata.end).toBe(47);
    expect(result!.userComment).toBe('My comment');
  });

  it('should return null for comment without @gn tag', () => {
    const result = parseGnComment('Just a regular comment');

    expect(result).toBeNull();
  });

  it('should handle tag-only comment (no user text)', () => {
    const result = parseGnComment('`@gn:0:10`');

    expect(result).not.toBeNull();
    expect(result!.metadata.start).toBe(0);
    expect(result!.metadata.end).toBe(10);
    expect(result!.userComment).toBe('');
  });

  it('should handle multi-line user comment with tag at end', () => {
    const result = parseGnComment('First line.\n\nSecond paragraph. `@gn:5:20`');

    expect(result).not.toBeNull();
    expect(result!.metadata.start).toBe(5);
    expect(result!.metadata.end).toBe(20);
    expect(result!.userComment).toBe('First line.\n\nSecond paragraph.');
  });

  it('should handle large offsets', () => {
    const result = parseGnComment('Comment `@gn:1000:2000`');

    expect(result).not.toBeNull();
    expect(result!.metadata.start).toBe(1000);
    expect(result!.metadata.end).toBe(2000);
  });

  it('should return null for malformed tag', () => {
    expect(parseGnComment('`@gn:abc:def`')).toBeNull();
    expect(parseGnComment('`@gn:12`')).toBeNull();
    expect(parseGnComment('`@gn:`')).toBeNull();
  });

  it('should handle tag without backticks (raw text)', () => {
    // In textContent, backticks are stripped — should still NOT match
    // since the format requires backticks
    const result = parseGnComment('@gn:12:47');

    expect(result).toBeNull();
  });

  // Legacy format support
  it('should parse legacy <!-- @gn --> format', () => {
    const result = parseGnComment('<!-- @gn {"s":12,"e":47} -->\nMy comment');

    expect(result).not.toBeNull();
    expect(result!.metadata.start).toBe(12);
    expect(result!.metadata.end).toBe(47);
    expect(result!.userComment).toBe('My comment');
  });

  it('should parse legacy format with full field names', () => {
    const result = parseGnComment('<!-- @gn {"exact":"test","start":5,"end":9} -->\nComment');

    expect(result).not.toBeNull();
    expect(result!.metadata.start).toBe(5);
    expect(result!.metadata.end).toBe(9);
  });

  it('should prefer `@gn:` format over legacy when both present', () => {
    const result = parseGnComment('<!-- @gn {"s":1,"e":2} -->\nComment `@gn:10:20`');

    expect(result).not.toBeNull();
    // Primary format should win
    expect(result!.metadata.start).toBe(10);
    expect(result!.metadata.end).toBe(20);
  });
});
