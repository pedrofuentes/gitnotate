import type { SidecarFile } from '@gitnotate/core';

export interface AnchorValidationResult {
  annotationId: string;
  filePath: string;
  status: 'valid' | 'broken' | 'fuzzy';
  message: string;
}

/**
 * Validates that annotation anchors in a sidecar file still match the target file content.
 *
 * For each annotation:
 * - If `target.exact` is found and prefix/suffix match → valid
 * - If `target.exact` is found but prefix/suffix don't match → fuzzy
 * - If `target.exact` is not found at all → broken
 */
export async function validateAnchors(
  _sidecarPath: string,
  sidecarContent: string,
  fileContent: string,
): Promise<AnchorValidationResult[]> {
  const sidecar: SidecarFile = JSON.parse(sidecarContent);
  const results: AnchorValidationResult[] = [];

  for (const annotation of sidecar.annotations) {
    const { exact, prefix, suffix } = annotation.target;
    const idx = fileContent.indexOf(exact);

    if (idx === -1) {
      results.push({
        annotationId: annotation.id,
        filePath: sidecar.file,
        status: 'broken',
        message: 'Text not found',
      });
      continue;
    }

    // Exact text found — check prefix/suffix context
    const hasPrefix = prefix !== undefined && prefix.length > 0;
    const hasSuffix = suffix !== undefined && suffix.length > 0;

    if (!hasPrefix && !hasSuffix) {
      results.push({
        annotationId: annotation.id,
        filePath: sidecar.file,
        status: 'valid',
        message: 'Anchor intact',
      });
      continue;
    }

    const textBefore = fileContent.substring(0, idx);
    const textAfter = fileContent.substring(idx + exact.length);

    const prefixMatches = !hasPrefix || textBefore.endsWith(prefix);
    const suffixMatches = !hasSuffix || textAfter.startsWith(suffix);

    if (prefixMatches && suffixMatches) {
      results.push({
        annotationId: annotation.id,
        filePath: sidecar.file,
        status: 'valid',
        message: 'Anchor intact',
      });
    } else {
      results.push({
        annotationId: annotation.id,
        filePath: sidecar.file,
        status: 'fuzzy',
        message: 'Anchor shifted, fuzzy match',
      });
    }
  }

  return results;
}
