import type { GnCommentBody, GnMetadata } from './types';

// Matches `@gn:start:end` — the primary format (survives GitHub sanitization)
const GN_TAG_RE = /`@gn:(\d+):(\d+)`/;

// Legacy: <!-- @gn {...} --> (HTML comment — may be stripped by GitHub)
const GN_HTML_RE = /<!--\s*@gn\s+(\{.*?\})\s*-->/;

export function parseGnComment(commentBody: string): GnCommentBody | null {
  // Try primary format: `gn:start:end`
  const tagMatch = commentBody.match(GN_TAG_RE);
  if (tagMatch) {
    const start = Number(tagMatch[1]);
    const end = Number(tagMatch[2]);
    if (!isNaN(start) && !isNaN(end)) {
      const userComment = commentBody.replace(GN_TAG_RE, '').trim();
      return {
        metadata: { exact: '', start, end },
        userComment,
      };
    }
  }

  // Fallback: legacy HTML comment format
  const htmlMatch = commentBody.match(GN_HTML_RE);
  if (htmlMatch) {
    try {
      const obj = JSON.parse(htmlMatch[1]);
      const start = typeof obj.s === 'number' ? obj.s : typeof obj.start === 'number' ? obj.start : undefined;
      const end = typeof obj.e === 'number' ? obj.e : typeof obj.end === 'number' ? obj.end : undefined;

      if (start !== undefined && end !== undefined) {
        const userComment = commentBody
          .replace(GN_HTML_RE, '')
          .replace(/^>\s*📌.*$/m, '') // remove blockquote fallback
          .trim();
        return {
          metadata: { exact: typeof obj.exact === 'string' ? obj.exact : '', start, end },
          userComment,
        };
      }
    } catch {
      // Invalid JSON
    }
  }

  return null;
}
