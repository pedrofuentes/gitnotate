import * as vscode from 'vscode';
import { parseGnComment } from '@gitnotate/core';
import type { PrService, PullRequestInfo, ReviewComment } from './pr-service';
import type { CommentController } from './comment-controller';
import { debug } from './logger';

// Matches the > 📌 **"quoted text"** (chars N–M) blockquote line
const BLOCKQUOTE_FALLBACK_RE = /^>\s*📌\s*\*\*".*?"\*\*\s*\(chars\s*\d+[–-]\d+\)\s*\n*/;

export function stripBlockquoteFallback(text: string): string {
  return text.replace(BLOCKQUOTE_FALLBACK_RE, '').trim();
}

export class CommentThreadSync {
  private cache: Map<string, ReviewComment[]> = new Map();

  constructor(
    private prService: PrService,
    private commentController: CommentController
  ) {}

  async syncForDocument(
    uri: vscode.Uri,
    relativePath: string,
    pr: PullRequestInfo
  ): Promise<vscode.Range[]> {
    this.commentController.clearThreads(uri);

    const comments = await this.getComments(pr);
    const fileComments = comments.filter((c) => c.path === relativePath);
    debug('Thread sync:', fileComments.length, 'comments for', relativePath);

    // Separate root comments (with ^gn metadata) from replies
    const rootComments: ReviewComment[] = [];
    const repliesByParent = new Map<number, ReviewComment[]>();

    for (const comment of fileComments) {
      if (comment.inReplyToId !== undefined) {
        const existing = repliesByParent.get(comment.inReplyToId) ?? [];
        existing.push(comment);
        repliesByParent.set(comment.inReplyToId, existing);
      } else {
        rootComments.push(comment);
      }
    }

    let threadsCreated = 0;
    let gnThreads = 0;
    let lineThreads = 0;
    const highlightRanges: vscode.Range[] = [];

    for (const root of rootComments) {
      const parsed = parseGnComment(root.body);

      const replies = repliesByParent.get(root.id) ?? [];

      if (parsed) {
        // ^gn comment: sub-line range + wavy underline
        const { metadata, userComment } = parsed;
        const cleanBody = stripBlockquoteFallback(userComment);
        const line = metadata.lineNumber - 1;
        const range = new vscode.Range(line, metadata.start, line, metadata.end);

        const threadComments = [
          { body: cleanBody, author: root.userLogin ?? 'unknown' },
        ];
        for (const reply of replies) {
          threadComments.push({ body: reply.body, author: reply.userLogin ?? 'unknown' });
        }

        this.commentController.createThread(uri, range, threadComments, gnThreads);
        highlightRanges.push(range);
        gnThreads++;
      } else {
        // Regular line comment: full-line range, no underline highlight
        const line = (root.line ?? 1) - 1;
        const range = new vscode.Range(line, 0, line, 0);

        const threadComments = [
          { body: root.body, author: root.userLogin ?? 'unknown' },
        ];
        for (const reply of replies) {
          threadComments.push({ body: reply.body, author: reply.userLogin ?? 'unknown' });
        }

        this.commentController.createThread(uri, range, threadComments);
        lineThreads++;
      }

      threadsCreated++;
    }

    debug('Thread sync: created', threadsCreated, 'threads (' + gnThreads, '^gn +', lineThreads, 'line)');
    return highlightRanges;
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  private async getComments(pr: PullRequestInfo): Promise<ReviewComment[]> {
    const cacheKey = `${pr.owner}/${pr.repo}#${pr.number}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      debug('Thread sync: using cached comments for', cacheKey);
      return cached;
    }

    debug('Thread sync: fetching comments for', cacheKey);
    const comments = await this.prService.listReviewComments(pr);
    this.cache.set(cacheKey, comments);
    return comments;
  }
}
