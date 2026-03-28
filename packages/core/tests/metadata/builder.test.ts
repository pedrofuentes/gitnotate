import { describe, it, expect } from 'vitest';
import { buildGnComment } from '../../src/metadata/builder';
import { parseGnComment } from '../../src/metadata/parser';
import type { GnMetadata } from '../../src/metadata/types';

describe('buildGnComment', () => {
  it('should build a well-formed @gn comment body', () => {
    const metadata: GnMetadata = {
      exact: 'revenue growth exceeded expectations',
      start: 12,
      end: 47,
    };
    const userComment = 'Can we add the exact percentage here?';

    const result = buildGnComment(metadata, userComment);

    expect(result).toContain('<!-- @gn');
    expect(result).toContain('-->');
    expect(result).toContain('> 📌 **"revenue growth exceeded expectations"** (chars 12–47)');
    expect(result).toContain('Can we add the exact percentage here?');
  });

  it('should properly escape special characters in exact text', () => {
    const metadata: GnMetadata = {
      exact: 'say "hello" <world>',
      start: 0,
      end: 20,
    };

    const result = buildGnComment(metadata, 'Test comment');

    // The JSON inside the HTML comment should have escaped quotes
    expect(result).toContain('@gn');
    expect(result).toContain('-->');

    // The blockquote should escape angle brackets for markdown rendering
    const lines = result.split('\n');
    const blockquoteLine = lines.find((l) => l.startsWith('>'));
    expect(blockquoteLine).toBeDefined();
    // Angle brackets should be escaped in blockquote for safe markdown rendering
    expect(blockquoteLine).toContain('&lt;');
    expect(blockquoteLine).toContain('&gt;');
  });

  it('should handle empty user comment', () => {
    const metadata: GnMetadata = { exact: 'text', start: 0, end: 4 };

    const result = buildGnComment(metadata, '');

    expect(result).toContain('<!-- @gn');
    expect(result).toContain('> 📌');
    // Should not have trailing newlines for empty comment
    const lines = result.split('\n');
    const lastNonEmpty = lines.filter((l) => l.length > 0);
    expect(lastNonEmpty[lastNonEmpty.length - 1]).toMatch(/^>/);
  });

  it('should handle multi-line user comments', () => {
    const metadata: GnMetadata = { exact: 'foo', start: 0, end: 3 };
    const userComment = 'First line.\n\nSecond paragraph.';

    const result = buildGnComment(metadata, userComment);

    expect(result).toContain('First line.\n\nSecond paragraph.');
  });

  it('should produce output that parser can round-trip', () => {
    const metadata: GnMetadata = {
      exact: 'revenue growth exceeded expectations',
      start: 12,
      end: 47,
    };
    const userComment = 'Can we add the exact percentage here?';

    const built = buildGnComment(metadata, userComment);
    const parsed = parseGnComment(built);

    expect(parsed).not.toBeNull();
    expect(parsed!.metadata).toEqual(metadata);
    expect(parsed!.userComment).toBe(userComment);
  });

  it('should handle unicode characters in exact text', () => {
    const metadata: GnMetadata = {
      exact: '日本語テスト 🚀 café',
      start: 0,
      end: 14,
    };
    const userComment = 'Unicode works!';

    const built = buildGnComment(metadata, userComment);
    const parsed = parseGnComment(built);

    expect(parsed).not.toBeNull();
    expect(parsed!.metadata.exact).toBe('日本語テスト 🚀 café');
  });

  it('should handle very long exact text', () => {
    const longText = 'a'.repeat(500);
    const metadata: GnMetadata = { exact: longText, start: 0, end: 500 };
    const userComment = 'Long text test.';

    const built = buildGnComment(metadata, userComment);
    const parsed = parseGnComment(built);

    expect(parsed).not.toBeNull();
    expect(parsed!.metadata.exact).toBe(longText);
    expect(parsed!.userComment).toBe(userComment);
  });
});
