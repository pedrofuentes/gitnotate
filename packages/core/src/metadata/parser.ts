import type { GnCommentBody, GnMetadata } from './types';

const GN_PATTERN = /^\s*<!--\s*@gn\s+(.*?)\s*-->\s*$/;

function isValidMetadata(obj: unknown): obj is GnMetadata {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.exact === 'string' &&
    typeof o.start === 'number' &&
    typeof o.end === 'number'
  );
}

export function parseGnComment(commentBody: string): GnCommentBody | null {
  const lines = commentBody.split('\n');

  // Find the @gn metadata line
  const metaLineIndex = lines.findIndex((line) => GN_PATTERN.test(line));
  if (metaLineIndex === -1) return null;

  const match = lines[metaLineIndex].match(GN_PATTERN);
  if (!match) return null;

  let metadata: GnMetadata;
  try {
    const parsed = JSON.parse(match[1]);
    if (!isValidMetadata(parsed)) return null;
    metadata = { exact: parsed.exact, start: parsed.start, end: parsed.end };
  } catch {
    return null;
  }

  // Extract user comment: skip metadata line, optional blockquote, and separator
  let commentStartIndex = metaLineIndex + 1;

  // Skip blockquote line (starts with ">")
  if (commentStartIndex < lines.length && lines[commentStartIndex].trimStart().startsWith('>')) {
    commentStartIndex++;
  }

  // Skip empty separator lines between blockquote and user comment
  while (commentStartIndex < lines.length && lines[commentStartIndex].trim() === '') {
    commentStartIndex++;
  }

  const userComment = lines.slice(commentStartIndex).join('\n');

  return { metadata, userComment };
}
