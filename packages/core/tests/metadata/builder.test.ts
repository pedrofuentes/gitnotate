import { describe, it, expect } from 'vitest';
import { buildGnComment } from '../../src/metadata/builder';
import { parseGnComment } from '../../src/metadata/parser';
import type { GnMetadata } from '../../src/metadata/types';

describe('buildGnComment', () => {
  it('should build comment with @gn tag including line number', () => {
    const metadata: GnMetadata = {
      exact: 'revenue growth exceeded expectations',
      lineNumber: 5,
      start: 12,
      end: 47,
    };
    const result = buildGnComment(metadata, 'Can we add the exact percentage?');

    expect(result).toBe('Can we add the exact percentage? `@gn:5:12:47`');
  });

  it('should return just the tag for empty user comment', () => {
    const metadata: GnMetadata = { exact: 'text', lineNumber: 1, start: 0, end: 4 };

    const result = buildGnComment(metadata, '');

    expect(result).toBe('`@gn:1:0:4`');
  });

  it('should handle multi-line user comments', () => {
    const metadata: GnMetadata = { exact: 'foo', lineNumber: 10, start: 0, end: 3 };

    const result = buildGnComment(metadata, 'First line.\n\nSecond paragraph.');

    expect(result).toBe('First line.\n\nSecond paragraph. `@gn:10:0:3`');
  });

  it('should produce output that parser can round-trip', () => {
    const metadata: GnMetadata = {
      exact: 'revenue growth',
      lineNumber: 5,
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
    const metadata: GnMetadata = { exact: 'test', lineNumber: 3, start: 5, end: 9 };

    const result = buildGnComment(metadata, 'Check "this" & <that>');

    expect(result).toContain('Check "this" & <that>');
    expect(result).toContain('`@gn:3:5:9`');
  });

  it('should handle large offsets', () => {
    const metadata: GnMetadata = { exact: 'text', lineNumber: 500, start: 1000, end: 2000 };

    const result = buildGnComment(metadata, 'Comment');

    expect(result).toBe('Comment `@gn:500:1000:2000`');
  });
});
