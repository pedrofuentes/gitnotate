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
    const lines = comment.split('\n');

    // Verify exact structure line-by-line
    expect(lines[0]).toBe('## 📝 Gitnotate Anchor Report');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('✅ **1 valid** | ⚠️ **1 fuzzy** | ❌ **1 broken**');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('| Status | File | Annotation | Details |');
    expect(lines[5]).toBe('|--------|------|------------|---------|');
    expect(lines[6]).toBe('| ✅ | docs/spec.md | `a1` | Anchor intact |');
    expect(lines[7]).toBe('| ⚠️ | docs/spec.md | `a2` | Anchor shifted, fuzzy match |');
    expect(lines[8]).toBe('| ❌ | docs/plan.md | `a3` | Text not found |');
    expect(lines).toHaveLength(9);
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
    const lines = comment.split('\n');

    expect(lines[2]).toBe('✅ **3 valid** | ⚠️ **1 fuzzy** | ❌ **1 broken**');
    // 6 header/separator lines + 5 data rows
    expect(lines).toHaveLength(11);
    // Verify each data row starts with the correct icon
    expect(lines.slice(6).filter((l) => l.startsWith('| ✅'))).toHaveLength(3);
    expect(lines.slice(6).filter((l) => l.startsWith('| ⚠️'))).toHaveLength(1);
    expect(lines.slice(6).filter((l) => l.startsWith('| ❌'))).toHaveLength(1);
  });

  it('should handle empty results', () => {
    const comment = buildSummaryComment([]);
    const lines = comment.split('\n');

    expect(lines[0]).toBe('## 📝 Gitnotate Anchor Report');
    expect(lines[2]).toBe('✅ **0 valid** | ⚠️ **0 fuzzy** | ❌ **0 broken**');
    // Header + blank + summary + blank + table header + separator = 6 lines, no data rows
    expect(lines).toHaveLength(6);
  });
});
