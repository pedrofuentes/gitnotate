import { describe, it, expect } from 'vitest';
import {
  createSidecarFile,
  addAnnotation,
  addReply,
  resolveAnnotation,
  reopenAnnotation,
  deleteAnnotation,
} from '../../src/schema/sidecar-crud';
import type { SidecarFile, Author, Annotation } from '../../src/schema/types';

const author: Author = { github: 'octocat', name: 'Octocat' };

describe('createSidecarFile', () => {
  it('should create a new empty sidecar file', () => {
    const sidecar = createSidecarFile('docs/README.md');
    expect(sidecar.version).toBe('1.0');
    expect(sidecar.file).toBe('docs/README.md');
    expect(sidecar.annotations).toEqual([]);
    expect(sidecar.$schema).toBeDefined();
  });
});

describe('addAnnotation', () => {
  it('should add an annotation with auto-generated ID and timestamp', () => {
    const sidecar = createSidecarFile('README.md');
    const updated = addAnnotation(sidecar, {
      target: { exact: 'hello world' },
      author,
      body: 'Great intro!',
    });

    expect(updated.annotations).toHaveLength(1);
    const ann = updated.annotations[0];
    expect(ann.id).toBeDefined();
    expect(ann.id.length).toBeGreaterThan(0);
    expect(ann.target.exact).toBe('hello world');
    expect(ann.author.github).toBe('octocat');
    expect(ann.body).toBe('Great intro!');
    expect(ann.created).toBeDefined();
    expect(ann.resolved).toBe(false);
    expect(ann.replies).toEqual([]);
    // created should be a valid ISO date
    expect(new Date(ann.created).toISOString()).toBe(ann.created);
  });

  it('should not mutate the original sidecar object', () => {
    const sidecar = createSidecarFile('README.md');
    const updated = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'comment',
    });
    expect(sidecar.annotations).toHaveLength(0);
    expect(updated.annotations).toHaveLength(1);
    expect(sidecar).not.toBe(updated);
  });

  it('should generate unique IDs for annotations', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'first' },
      author,
      body: 'one',
    });
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'second' },
      author,
      body: 'two',
    });
    const ids = sidecar.annotations.map((a) => a.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('addReply', () => {
  it('should add a reply to an existing annotation', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'comment',
    });
    const annId = sidecar.annotations[0].id;

    const updated = addReply(sidecar, annId, {
      author: { github: 'contributor' },
      body: 'I agree!',
    });

    expect(updated.annotations[0].replies).toHaveLength(1);
    const reply = updated.annotations[0].replies[0];
    expect(reply.id).toBeDefined();
    expect(reply.author.github).toBe('contributor');
    expect(reply.body).toBe('I agree!');
    expect(reply.created).toBeDefined();
    expect(new Date(reply.created).toISOString()).toBe(reply.created);
  });

  it('should throw when adding reply to non-existent annotation', () => {
    const sidecar = createSidecarFile('README.md');
    expect(() =>
      addReply(sidecar, 'non-existent', {
        author,
        body: 'reply',
      }),
    ).toThrow();
  });

  it('should not mutate the original sidecar object', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'comment',
    });
    const annId = sidecar.annotations[0].id;

    const updated = addReply(sidecar, annId, {
      author: { github: 'other' },
      body: 'reply',
    });

    expect(sidecar.annotations[0].replies).toHaveLength(0);
    expect(updated.annotations[0].replies).toHaveLength(1);
  });

  it('should generate unique IDs for replies', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'comment',
    });
    const annId = sidecar.annotations[0].id;

    sidecar = addReply(sidecar, annId, { author, body: 'reply 1' });
    sidecar = addReply(sidecar, annId, { author, body: 'reply 2' });

    const ids = sidecar.annotations[0].replies.map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('resolveAnnotation', () => {
  it('should resolve an annotation', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'fix this',
    });
    const annId = sidecar.annotations[0].id;
    const resolver: Author = { github: 'reviewer' };

    const updated = resolveAnnotation(sidecar, annId, resolver);
    const ann = updated.annotations[0];
    expect(ann.resolved).toBe(true);
    expect(ann.resolvedBy?.github).toBe('reviewer');
    expect(ann.resolvedAt).toBeDefined();
  });

  it('should throw when resolving non-existent annotation', () => {
    const sidecar = createSidecarFile('README.md');
    expect(() => resolveAnnotation(sidecar, 'missing', author)).toThrow();
  });
});

describe('reopenAnnotation', () => {
  it('should reopen a resolved annotation', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'fix this',
    });
    const annId = sidecar.annotations[0].id;
    sidecar = resolveAnnotation(sidecar, annId, { github: 'reviewer' });

    const updated = reopenAnnotation(sidecar, annId);
    const ann = updated.annotations[0];
    expect(ann.resolved).toBe(false);
    expect(ann.resolvedBy).toBeUndefined();
    expect(ann.resolvedAt).toBeUndefined();
  });

  it('should throw when reopening non-existent annotation', () => {
    const sidecar = createSidecarFile('README.md');
    expect(() => reopenAnnotation(sidecar, 'missing')).toThrow();
  });
});

describe('deleteAnnotation', () => {
  it('should delete an annotation', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'comment',
    });
    const annId = sidecar.annotations[0].id;

    const updated = deleteAnnotation(sidecar, annId);
    expect(updated.annotations).toHaveLength(0);
  });

  it('should throw when deleting non-existent annotation', () => {
    const sidecar = createSidecarFile('README.md');
    expect(() => deleteAnnotation(sidecar, 'missing')).toThrow();
  });

  it('should not mutate the original sidecar object', () => {
    let sidecar = createSidecarFile('README.md');
    sidecar = addAnnotation(sidecar, {
      target: { exact: 'text' },
      author,
      body: 'comment',
    });
    const annId = sidecar.annotations[0].id;

    const updated = deleteAnnotation(sidecar, annId);
    expect(sidecar.annotations).toHaveLength(1);
    expect(updated.annotations).toHaveLength(0);
  });
});
