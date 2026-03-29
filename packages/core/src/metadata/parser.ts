import type { GnCommentBody } from './types';

// Matches @gn:line:start:end (3-field format, no backticks)
const GN_TAG_RE = /@gn:(\d+):(\d+):(\d+)/;

export function parseGnComment(commentBody: string): GnCommentBody | null {
  const tagMatch = commentBody.match(GN_TAG_RE);
  if (tagMatch) {
    const lineNumber = Number(tagMatch[1]);
    const start = Number(tagMatch[2]);
    const end = Number(tagMatch[3]);
    if (!isNaN(lineNumber) && !isNaN(start) && !isNaN(end)) {
      const userComment = commentBody.replace(GN_TAG_RE, '').trim();
      return {
        metadata: { exact: '', lineNumber, start, end },
        userComment,
      };
    }
  }

  return null;
}
