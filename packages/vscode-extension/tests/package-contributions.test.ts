import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('package.json contributions', () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
  );

  it('has editor/context menu for addComment', () => {
    const editorContext = pkg.contributes.menus['editor/context'];
    expect(editorContext).toBeDefined();

    const addComment = editorContext.find(
      (item: any) => item.command === 'gitnotate.addComment'
    );
    expect(addComment).toBeDefined();
    expect(addComment.when).toContain('editorHasSelection');
    expect(addComment.when).toContain('markdown');
    expect(addComment.when).toContain('gitnotate.hasPR');
    expect(addComment.group).toBe('gitnotate@1');
  });
});
