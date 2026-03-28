import type { AnchorValidationResult } from './anchor-validator.js';

const STATUS_ICONS: Record<AnchorValidationResult['status'], string> = {
  valid: '✅',
  fuzzy: '⚠️',
  broken: '❌',
};

export function buildSummaryComment(results: AnchorValidationResult[]): string {
  const counts = { valid: 0, fuzzy: 0, broken: 0 };
  for (const r of results) {
    counts[r.status]++;
  }

  const lines: string[] = [
    '## 📝 Gitnotate Anchor Report',
    '',
    `✅ **${counts.valid} valid** | ⚠️ **${counts.fuzzy} fuzzy** | ❌ **${counts.broken} broken**`,
    '',
    '| Status | File | Annotation | Details |',
    '|--------|------|------------|---------|',
  ];

  for (const r of results) {
    const icon = STATUS_ICONS[r.status];
    lines.push(`| ${icon} | ${r.filePath} | \`${r.annotationId}\` | ${r.message} |`);
  }

  return lines.join('\n');
}
