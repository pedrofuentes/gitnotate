import * as vscode from 'vscode';
import { parseGnComment } from '@gitnotate/core';
import type { PrService, PullRequestInfo, ReviewComment } from './pr-service';
import type { CommentController } from './comment-controller';
import { debug, getLogger, Logger } from './logger';

// Matches the > 📌 **"quoted text"** (chars N–M) blockquote line
const BLOCKQUOTE_FALLBACK_RE = /^>\s*📌\s*\*\*".*?"\*\*\s*\(chars\s*\d+[–-]\d+\)\s*\n*/;

export function stripBlockquoteFallback(text: string): string {
  return text.replace(BLOCKQUOTE_FALLBACK_RE, '').trim();
}

export class CommentThreadSync {
  private cache: Map<string, ReviewComment[]> = new Map();
  private log: Logger | undefined;

  constructor(
    private prService: PrService,
    private commentController: CommentController
  ) {
    try { this.log = getLogger(); } catch { /* logger not initialized */ }
  }

  async syncForDocument(
    uri: vscode.Uri,
    relativePath: string,
    pr: PullRequestInfo
  ): Promise<vscode.Range[]> {
    this.log?.info('ThreadSync', 'syncing', relativePath, `PR #${pr.number}`);
    const comments = await this.getComments(pr);
    return this.renderComments(uri, relativePath, comments);
  }

  private renderComments(
    uri: vscode.Uri,
    relativePath: string,
    comments: ReviewComment[]
  ): vscode.Range[] {
    this.commentController.clearThreads(uri);

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
        // Regular line comment: position at end of line, no underline highlight
        const line = (root.line ?? 1) - 1;
        const range = new vscode.Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER);

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

  getCachedComments(pr: PullRequestInfo): ReviewComment[] | undefined {
    const cacheKey = `${pr.owner}/${pr.repo}#${pr.number}`;
    return this.cache.get(cacheKey);
  }

  async syncForDocumentCacheFirst(
    uri: vscode.Uri,
    relativePath: string,
    pr: PullRequestInfo
  ): Promise<vscode.Range[]> {
    const cached = this.getCachedComments(pr);
    if (!cached) {
      this.log?.info('ThreadSync', 'cache miss — fetching from API');
      debug('Thread sync (cache-first): no cache — falling back to normal sync');
      return this.syncForDocument(uri, relativePath, pr);
    }

    // Render from cache immediately
    this.log?.info('ThreadSync', 'cache hit — rendering from cache');
    debug('Thread sync (cache-first): rendering from cache');
    const cachedRanges = this.renderComments(uri, relativePath, cached);

    // Fetch fresh data in background
    debug('Thread sync (cache-first): fetching fresh data');
    const cacheKey = `${pr.owner}/${pr.repo}#${pr.number}`;
    const freshComments = await this.prService.listReviewComments(pr);

    // null means 304 Not Modified — data unchanged, keep cache
    if (freshComments === null) {
      debug('Thread sync (cache-first): 304 not modified — skipping re-render');
      return cachedRanges;
    }

    // Compare: if data changed, re-render
    const cacheFingerprint = JSON.stringify(cached.map((c) => c.id).sort());
    const freshFingerprint = JSON.stringify(freshComments.map((c) => c.id).sort());

    if (cacheFingerprint !== freshFingerprint) {
      debug('Thread sync (cache-first): data changed — re-rendering');
      this.cache.set(cacheKey, freshComments);
      return this.renderComments(uri, relativePath, freshComments);
    }

    debug('Thread sync (cache-first): data unchanged — skipping re-render');
    this.cache.set(cacheKey, freshComments);
    return cachedRanges;
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
    if (comments === null) {
      debug('Thread sync: 304 not modified, no cache available for', cacheKey);
      return [];
    }
    this.cache.set(cacheKey, comments);
    return comments;
  }
}
