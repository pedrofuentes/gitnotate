import type { GnMetadata } from './types';

export function buildGnComment(metadata: GnMetadata, userComment: string): string {
  const tag = `^gn:${metadata.lineNumber}:${metadata.side}:${metadata.start}:${metadata.end}`;

  if (!userComment) {
    return tag;
  }

  return `${tag}\n${userComment}`;
}
