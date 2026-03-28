import { describe, it, expect } from 'vitest';
import { validateSidecarFile, validateAnnotation } from '../../src/schema/validation';
import type { SidecarFile, Annotation } from '../../src/schema/types';

function validAnnotation(overrides?: Partial<Annotation>): Annotation {
  return {
    id: 'ann-1',
    target: { exact: 'some selected text', prefix: 'before ', suffix: ' after' },
    author: { github: 'octocat', name: 'Octocat' },
    body: 'This is a comment',
    created: '2025-01-15T10:30:00Z',
    resolved: false,
    replies: [],
    ...overrides,
  };
}

function validSidecar(overrides?: Partial<SidecarFile>): SidecarFile {
  return {
    $schema: 'https://gitnotate.dev/schemas/sidecar-v1.json',
    version: '1.0',
    file: 'docs/README.md',
    annotations: [validAnnotation()],
    ...overrides,
  };
}

describe('validateSidecarFile', () => {
  it('should validate a well-formed sidecar file', () => {
    const result = validateSidecarFile(validSidecar());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should reject missing version', () => {
    const data = validSidecar();
    delete (data as Record<string, unknown>).version;
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('should reject invalid version', () => {
    const data = { ...validSidecar(), version: '2.0' };
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('should reject missing file path', () => {
    const data = validSidecar();
    delete (data as Record<string, unknown>).file;
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('file'))).toBe(true);
  });

  it('should reject empty file path', () => {
    const result = validateSidecarFile(validSidecar({ file: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('file'))).toBe(true);
  });

  it('should reject empty annotations array items with missing fields', () => {
    const data = validSidecar({
      annotations: [{ id: 'a1' } as unknown as Annotation],
    });
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject duplicate annotation IDs', () => {
    const ann = validAnnotation();
    const data = validSidecar({
      annotations: [ann, { ...ann, target: { exact: 'other text' } }],
    });
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate') || e.includes('unique'))).toBe(true);
  });

  it('should reject invalid ISO 8601 dates', () => {
    const data = validSidecar({
      annotations: [validAnnotation({ created: 'not-a-date' })],
    });
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('created') || e.includes('date') || e.includes('ISO'))).toBe(true);
  });

  it('should reject empty target.exact', () => {
    const data = validSidecar({
      annotations: [validAnnotation({ target: { exact: '' } })],
    });
    const result = validateSidecarFile(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exact') || e.includes('target'))).toBe(true);
  });

  it('should validate annotations with optional fields omitted', () => {
    const ann = validAnnotation();
    delete ann.target.prefix;
    delete ann.target.suffix;
    delete ann.author.name;
    delete ann.updated;
    const result = validateSidecarFile(validSidecar({ annotations: [ann] }));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should validate replies within annotations', () => {
    const ann = validAnnotation({
      replies: [
        {
          id: 'reply-1',
          author: { github: 'contributor' },
          body: 'Good point!',
          created: '2025-01-15T11:00:00Z',
        },
      ],
    });
    const result = validateSidecarFile(validSidecar({ annotations: [ann] }));
    expect(result.valid).toBe(true);
  });

  it('should reject replies with missing fields', () => {
    const ann = validAnnotation({
      replies: [{ id: 'reply-1' } as unknown as import('../../src/schema/types').Reply],
    });
    const result = validateSidecarFile(validSidecar({ annotations: [ann] }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject duplicate IDs across annotations and replies', () => {
    const ann = validAnnotation({
      id: 'shared-id',
      replies: [
        {
          id: 'shared-id',
          author: { github: 'user' },
          body: 'reply',
          created: '2025-01-15T11:00:00Z',
        },
      ],
    });
    const result = validateSidecarFile(validSidecar({ annotations: [ann] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate') || e.includes('unique'))).toBe(true);
  });

  it('should reject non-object input', () => {
    const result = validateSidecarFile('not an object');
    expect(result.valid).toBe(false);
  });

  it('should reject null input', () => {
    const result = validateSidecarFile(null);
    expect(result.valid).toBe(false);
  });

  it('should validate resolved annotation with resolvedBy and resolvedAt', () => {
    const ann = validAnnotation({
      resolved: true,
      resolvedBy: { github: 'reviewer' },
      resolvedAt: '2025-01-16T09:00:00Z',
    });
    const result = validateSidecarFile(validSidecar({ annotations: [ann] }));
    expect(result.valid).toBe(true);
  });

  it('should reject invalid updated date on annotation', () => {
    const ann = validAnnotation({ updated: 'bad-date' });
    const result = validateSidecarFile(validSidecar({ annotations: [ann] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('updated') || e.includes('date') || e.includes('ISO'))).toBe(true);
  });
});

describe('validateAnnotation', () => {
  it('should validate a well-formed annotation', () => {
    const result = validateAnnotation(validAnnotation());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should reject annotation with missing required fields', () => {
    const result = validateAnnotation({ id: 'a1' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject non-object input', () => {
    const result = validateAnnotation(42);
    expect(result.valid).toBe(false);
  });
});
