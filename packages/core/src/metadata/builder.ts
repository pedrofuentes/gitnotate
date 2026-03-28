import type { GnMetadata } from './types';

function escapeMarkdown(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text: string, maxLen = 50): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

export function buildGnComment(metadata: GnMetadata, userComment: string): string {
  const metaLine = `<!-- @gn ${JSON.stringify({ s: metadata.start, e: metadata.end })} -->`;

  if (!userComment) {
    return metaLine;
  }

  return `${metaLine}\n${userComment}`;
}
