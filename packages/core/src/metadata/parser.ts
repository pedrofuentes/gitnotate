import type { GnCommentBody } from './types';

// Matches ^gn:line:side:start:end (4-field format)
const GN_TAG_RE = /\^gn:(\d+):([LR]):(\d+):(\d+)/;

export function parseGnComment(commentBody: string): GnCommentBody | null {
  const tagMatch = commentBody.match(GN_TAG_RE);
  if (tagMatch) {
    const lineNumber = Number(tagMatch[1]);
    const side = tagMatch[2] as 'L' | 'R';
    const start = Number(tagMatch[3]);
    const end = Number(tagMatch[4]);
    if (!isNaN(lineNumber) && !isNaN(start) && !isNaN(end) && start < end) {
      const userComment = commentBody.replace(GN_TAG_RE, '').trim();
      return {
        metadata: { exact: '', lineNumber, side, start, end },
        userComment,
      };
    }
  }

  return null;
}
