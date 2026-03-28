import { describe, it, expect } from 'vitest';
import { parseGnComment } from '../../src/metadata/parser';
import type { GnCommentBody } from '../../src/metadata/types';

describe('parseGnComment', () => {
  it('should parse a well-formed @gn comment', () => {
    const input = [
      '<!-- @gn {"exact":"revenue growth exceeded expectations","start":12,"end":47} -->',
      '> 📌 **"revenue growth exceeded expectations"** (chars 12–47)',
      '',
      'Can we add the exact percentage here?',
    ].join('\n');

    const result = parseGnComment(input);

    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual({
      exact: 'revenue growth exceeded expectations',
      start: 12,
      end: 47,
    });
    expect(result!.userComment).toBe('Can we add the exact percentage here?');
  });

  it('should return null for a comment without @gn metadata', () => {
    const input = 'This is a regular PR comment with no metadata.';
    expect(parseGnComment(input)).toBeNull();
  });

  it('should handle extra whitespace', () => {
    const input = [
      '  <!-- @gn  {"exact":"hello","start":0,"end":5}  -->  ',
      '> 📌 **"hello"** (chars 0–5)',
      '',
      '  Some comment with leading spaces  ',
    ].join('\n');

    const result = parseGnComment(input);

    expect(result).not.toBeNull();
    expect(result!.metadata.exact).toBe('hello');
    expect(result!.userComment).toBe('  Some comment with leading spaces  ');
  });

  it('should handle multi-line user comments', () => {
    const input = [
      '<!-- @gn {"exact":"foo","start":0,"end":3} -->',
      '> 📌 **"foo"** (chars 0–3)',
      '',
      'First line of comment.',
      '',
      'Second paragraph.',
      '- A list item',
    ].join('\n');

    const result = parseGnComment(input);

    expect(result).not.toBeNull();
    expect(result!.userComment).toBe(
      'First line of comment.\n\nSecond paragraph.\n- A list item'
    );
  });

  it('should return null for malformed JSON in @gn metadata', () => {
    const input = '<!-- @gn {bad json} -->\nSome comment';
    expect(parseGnComment(input)).toBeNull();
  });

  it('should handle special characters in exact text (quotes, angle brackets)', () => {
    const input = [
      '<!-- @gn {"exact":"say \\"hello\\" <world>","start":0,"end":20} -->',
      '> 📌 **"say \\"hello\\" <world>"** (chars 0–20)',
      '',
      'Interesting quote.',
    ].join('\n');

    const result = parseGnComment(input);

    expect(result).not.toBeNull();
    expect(result!.metadata.exact).toBe('say "hello" <world>');
    expect(result!.metadata.start).toBe(0);
    expect(result!.metadata.end).toBe(20);
  });

  it('should handle empty user comment', () => {
    const input = [
      '<!-- @gn {"exact":"text","start":0,"end":4} -->',
      '> 📌 **"text"** (chars 0–4)',
    ].join('\n');

    const result = parseGnComment(input);

    expect(result).not.toBeNull();
    expect(result!.metadata.exact).toBe('text');
    expect(result!.userComment).toBe('');
  });

  it('should parse @gn metadata when there is no blockquote fallback', () => {
    const input = [
      '<!-- @gn {"exact":"text","start":0,"end":4} -->',
      '',
      'Just a comment, no blockquote.',
    ].join('\n');

    const result = parseGnComment(input);

    expect(result).not.toBeNull();
    expect(result!.metadata.exact).toBe('text');
    expect(result!.userComment).toBe('Just a comment, no blockquote.');
  });

  it('should ignore non-@gn HTML comments', () => {
    const input = [
      '<!-- some other comment -->',
      'This is a normal comment.',
    ].join('\n');

    expect(parseGnComment(input)).toBeNull();
  });

  it('should return null when required fields are missing from metadata', () => {
    const input = '<!-- @gn {"exact":"text"} -->\nComment';
    expect(parseGnComment(input)).toBeNull();
  });

  it('should return null when exact is not a string', () => {
    const input = '<!-- @gn {"exact":123,"start":0,"end":3} -->\nComment';
    expect(parseGnComment(input)).toBeNull();
  });
});
