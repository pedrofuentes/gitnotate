import { describe, it, expect } from 'vitest';
import { buildSummaryComment } from '../src/summary-reporter.js';
import type { AnchorValidationResult } from '../src/anchor-validator.js';

describe('buildSummaryComment', () => {
  it('should build markdown summary with all statuses', () => {
    const results: AnchorValidationResult[] = [
      { annotationId: 'a1', filePath: 'docs/spec.md', status: 'valid', message: 'Anchor intact' },
      { annotationId: 'a2', filePath: 'docs/spec.md', status: 'fuzzy', message: 'Anchor shifted, fuzzy match' },
      { annotationId: 'a3', filePath: 'docs/plan.md', status: 'broken', message: 'Text not found' },
    ];

    const comment = buildSummaryComment(results);

    expect(comment).toContain('## 📝 Gitnotate Anchor Report');
    expect(comment).toContain('✅ **1 valid**');
    expect(comment).toContain('⚠️ **1 fuzzy**');
    expect(comment).toContain('❌ **1 broken**');
    expect(comment).toContain('| Status | File | Annotation | Details |');
    expect(comment).toContain('| ✅ | docs/spec.md | `a1` | Anchor intact |');
    expect(comment).toContain('| ⚠️ | docs/spec.md | `a2` | Anchor shifted, fuzzy match |');
    expect(comment).toContain('| ❌ | docs/plan.md | `a3` | Text not found |');
  });

  it('should handle all valid results', () => {
    const results: AnchorValidationResult[] = [
      { annotationId: 'a1', filePath: 'docs/spec.md', status: 'valid', message: 'Anchor intact' },
      { annotationId: 'a2', filePath: 'docs/plan.md', status: 'valid', message: 'Anchor intact' },
    ];

    const comment = buildSummaryComment(results);

    expect(comment).toContain('✅ **2 valid**');
    expect(comment).toContain('⚠️ **0 fuzzy**');
    expect(comment).toContain('❌ **0 broken**');
    expect(comment).not.toContain('| ⚠️ |');
    expect(comment).not.toContain('| ❌ |');
  });

  it('should handle all broken results', () => {
    const results: AnchorValidationResult[] = [
      { annotationId: 'a1', filePath: 'docs/spec.md', status: 'broken', message: 'Text not found' },
      { annotationId: 'a2', filePath: 'docs/plan.md', status: 'broken', message: 'Text not found' },
    ];

    const comment = buildSummaryComment(results);

    expect(comment).toContain('✅ **0 valid**');
    expect(comment).toContain('⚠️ **0 fuzzy**');
    expect(comment).toContain('❌ **2 broken**');
    expect(comment).not.toContain('| ✅ |');
    expect(comment).not.toContain('| ⚠️ |');
  });

  it('should include correct counts', () => {
    const results: AnchorValidationResult[] = [
      { annotationId: 'a1', filePath: 'f1.md', status: 'valid', message: 'Anchor intact' },
      { annotationId: 'a2', filePath: 'f2.md', status: 'valid', message: 'Anchor intact' },
      { annotationId: 'a3', filePath: 'f3.md', status: 'valid', message: 'Anchor intact' },
      { annotationId: 'a4', filePath: 'f4.md', status: 'fuzzy', message: 'Anchor shifted, fuzzy match' },
      { annotationId: 'a5', filePath: 'f5.md', status: 'broken', message: 'Text not found' },
    ];

    const comment = buildSummaryComment(results);

    expect(comment).toContain('✅ **3 valid**');
    expect(comment).toContain('⚠️ **1 fuzzy**');
    expect(comment).toContain('❌ **1 broken**');
  });

  it('should handle empty results', () => {
    const comment = buildSummaryComment([]);

    expect(comment).toContain('## 📝 Gitnotate Anchor Report');
    expect(comment).toContain('✅ **0 valid**');
    expect(comment).toContain('⚠️ **0 fuzzy**');
    expect(comment).toContain('❌ **0 broken**');
  });
});
