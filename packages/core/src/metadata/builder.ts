import type { GnMetadata } from './types';

function escapeMarkdown(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildGnComment(metadata: GnMetadata, userComment: string): string {
  const json = JSON.stringify({
    exact: metadata.exact,
    start: metadata.start,
    end: metadata.end,
  });

  const metaLine = `<!-- @gn ${json} -->`;
  const escapedExact = escapeMarkdown(metadata.exact);
  const blockquote = `> 📌 **"${escapedExact}"** (chars ${metadata.start}–${metadata.end})`;

  if (!userComment) {
    return `${metaLine}\n${blockquote}`;
  }

  return `${metaLine}\n${blockquote}\n\n${userComment}`;
}
