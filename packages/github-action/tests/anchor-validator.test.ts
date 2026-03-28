import { describe, it, expect } from 'vitest';
import { validateAnchors, type AnchorValidationResult } from '../src/anchor-validator.js';

function makeSidecar(annotations: Array<{ id: string; exact: string; prefix?: string; suffix?: string }>) {
  return JSON.stringify({
    $schema: 'https://gitnotate.dev/schemas/sidecar-v1.json',
    version: '1.0',
    file: 'docs/spec.md',
    annotations: annotations.map((a) => ({
      id: a.id,
      target: {
        exact: a.exact,
        ...(a.prefix !== undefined ? { prefix: a.prefix } : {}),
        ...(a.suffix !== undefined ? { suffix: a.suffix } : {}),
      },
      author: { github: 'testuser' },
      body: 'A comment',
      created: '2025-01-01T00:00:00Z',
      resolved: false,
      replies: [],
    })),
  });
}

describe('validateAnchors', () => {
  it('should report valid when exact text found with matching prefix/suffix', async () => {
    const fileContent = 'The revenue growth exceeded expectations this quarter.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
        prefix: 'The ',
        suffix: ' exceeded',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual<AnchorValidationResult>({
      annotationId: 'a1',
      filePath: 'docs/spec.md',
      status: 'valid',
      message: 'Anchor intact',
    });
  });

  it('should report valid when exact text found without prefix/suffix defined', async () => {
    const fileContent = 'The revenue growth exceeded expectations this quarter.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('valid');
    expect(results[0].message).toBe('Anchor intact');
  });

  it('should report fuzzy when exact text found but prefix/suffix shifted', async () => {
    const fileContent = 'Our revenue growth exceeded expectations this quarter.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
        prefix: 'The ',
        suffix: ' was great',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual<AnchorValidationResult>({
      annotationId: 'a1',
      filePath: 'docs/spec.md',
      status: 'fuzzy',
      message: 'Anchor shifted, fuzzy match',
    });
  });

  it('should report broken when text not found', async () => {
    const fileContent = 'The team delivered great results this quarter.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
        prefix: 'The ',
        suffix: ' exceeded',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual<AnchorValidationResult>({
      annotationId: 'a1',
      filePath: 'docs/spec.md',
      status: 'broken',
      message: 'Text not found',
    });
  });

  it('should handle multiple annotations', async () => {
    const fileContent = 'The revenue growth exceeded expectations. The team delivered great results.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
        prefix: 'The ',
        suffix: ' exceeded',
      },
      {
        id: 'a2',
        exact: 'team delivered',
        prefix: 'The ',
        suffix: ' great',
      },
      {
        id: 'a3',
        exact: 'missing text',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('valid');
    expect(results[0].annotationId).toBe('a1');
    expect(results[1].status).toBe('valid');
    expect(results[1].annotationId).toBe('a2');
    expect(results[2].status).toBe('broken');
    expect(results[2].annotationId).toBe('a3');
  });

  it('should handle empty file', async () => {
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, '');

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('broken');
    expect(results[0].message).toBe('Text not found');
  });

  it('should report fuzzy when prefix matches but suffix does not', async () => {
    const fileContent = 'The revenue growth changed significantly.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
        prefix: 'The ',
        suffix: ' exceeded',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('fuzzy');
  });

  it('should report fuzzy when suffix matches but prefix does not', async () => {
    const fileContent = 'Our revenue growth exceeded expectations.';
    const sidecar = makeSidecar([
      {
        id: 'a1',
        exact: 'revenue growth',
        prefix: 'The ',
        suffix: ' exceeded',
      },
    ]);

    const results = await validateAnchors('docs/spec.md.comments/spec.md.json', sidecar, fileContent);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('fuzzy');
  });
});
