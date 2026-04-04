import { describe, it, expect } from 'vitest';
import { detectDocumentSide, detectRenderingSide, normalizeSide } from '../src/side-utils';
import { Uri } from '../__mocks__/vscode';

describe('detectDocumentSide', () => {
  it('should return LEFT for git: scheme URIs', () => {
    const uri = Object.assign(Uri.file('/workspace/docs/readme.md'), { scheme: 'git' });
    expect(detectDocumentSide(uri)).toBe('LEFT');
  });

  it('should return RIGHT for file: scheme URIs', () => {
    const uri = Uri.file('/workspace/docs/readme.md');
    expect(detectDocumentSide(uri)).toBe('RIGHT');
  });

  it('should return BOTH for untitled: scheme URIs', () => {
    const uri = Object.assign(Uri.file('Untitled-1'), { scheme: 'untitled' });
    expect(detectDocumentSide(uri)).toBe('BOTH');
  });

  it('should return BOTH for unknown scheme URIs', () => {
    const uri = Object.assign(Uri.file('/something'), { scheme: 'vscode-webview' });
    expect(detectDocumentSide(uri)).toBe('BOTH');
  });
});

describe('normalizeSide', () => {
  it('should normalize L to LEFT', () => {
    expect(normalizeSide('L')).toBe('LEFT');
  });

  it('should normalize R to RIGHT', () => {
    expect(normalizeSide('R')).toBe('RIGHT');
  });

  it('should pass through LEFT unchanged', () => {
    expect(normalizeSide('LEFT')).toBe('LEFT');
  });

  it('should pass through RIGHT unchanged', () => {
    expect(normalizeSide('RIGHT')).toBe('RIGHT');
  });

  it('should default unknown values to RIGHT', () => {
    expect(normalizeSide('UNKNOWN')).toBe('RIGHT');
  });
});

describe('detectRenderingSide', () => {
  it('should always return BOTH regardless of URI scheme', () => {
    const fileUri = Uri.file('/workspace/docs/readme.md');
    const gitUri = Object.assign(Uri.file('/workspace/docs/readme.md'), { scheme: 'git' });
    const unknownUri = Object.assign(Uri.file('/something'), { scheme: 'untitled' });

    expect(detectRenderingSide(fileUri)).toBe('BOTH');
    expect(detectRenderingSide(gitUri)).toBe('BOTH');
    expect(detectRenderingSide(unknownUri)).toBe('BOTH');
  });
});
