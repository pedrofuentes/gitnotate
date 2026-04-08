import * as vscode from 'vscode';
import { parseGnComment } from '@gitnotate/core';
import type { PrService, PullRequestInfo, ReviewComment } from './pr-service';
import type { CommentController } from './comment-controller';
import { debug, getLogger, Logger } from './logger';
import { normalizeSide } from './side-utils';
import { showAuthError, showApiError } from './error-handler';
import type { AnchorTracker } from './anchor-tracker';

// Matches the > 📌 **"quoted text"** (chars N–M) blockquote line
const BLOCKQUOTE_FALLBACK_RE = /^>\s*📌\s*\*\*".*?"\*\*\s*\(chars\s*\d+[–-]\d+\)\s*\n*/;

export const MAX_CACHE_SIZE = 50;

export function stripBlockquoteFallback(text: string): string {
  return text.replace(BLOCKQUOTE_FALLBACK_RE, '').trim();
}

export class CommentThreadSync {
  private cache: Map<string, ReviewComment[]> = new Map();
  private renderedFingerprints: Map<string, string> = new Map();
  private log: Logger | undefined;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private currentPr: PullRequestInfo | null = null;
  private currentUri: vscode.Uri | null = null;
  private currentRelativePath: string | null = null;

  constructor(
    private prService: PrService,
    private commentController: CommentController,
    private anchorTracker?: AnchorTracker
  ) {
    try { this.log = getLogger(); } catch { /* logger not initialized */ }
  }

  async syncForDocument(
    uri: vscode.Uri,
    relativePath: string,
    pr: PullRequestInfo
  ): Promise<vscode.Range[] | null> {
    this.log?.info('ThreadSync', 'syncing', relativePath, `PR #${pr.number}`);
    let comments: ReviewComment[];
    try {
      comments = await this.getComments(pr);
    } catch (err) {
      await this.handleFetchError(err);
      return [];
    }
    const rangesByUri = this.renderComments(relativePath, comments, { RIGHT: uri });
    if (rangesByUri === null) return null;
    return rangesByUri.get(uri.toString()) ?? [];
  }

  /**
   * Render comments with URI-based thread placement for diff views.
   * Each comment thread is created on its side-specific URI:
   * - LEFT comments → originalUri (left pane)
   * - RIGHT comments → modifiedUri (right pane)
   * VSCode routes threads to the correct pane automatically.
   */
  async syncForDiff(
    originalUri: vscode.Uri,
    modifiedUri: vscode.Uri,
    relativePath: string,
    pr: PullRequestInfo
  ): Promise<{ leftRanges: vscode.Range[]; rightRanges: vscode.Range[] } | null> {
    let comments: ReviewComment[];
    try {
      comments = await this.getComments(pr);
    } catch (err) {
      await this.handleFetchError(err);
      return { leftRanges: [], rightRanges: [] };
    }

    const uriMap = { LEFT: originalUri, RIGHT: modifiedUri };
    const rangesByUri = this.renderComments(relativePath, comments, uriMap);
    if (rangesByUri === null) return null;

    return {
      leftRanges: rangesByUri.get(originalUri.toString()) ?? [],
      rightRanges: rangesByUri.get(modifiedUri.toString()) ?? [],
    };
  }

  private renderComments(
    relativePath: string,
    comments: ReviewComment[],
    uriMap: { LEFT?: vscode.Uri; RIGHT?: vscode.Uri }
  ): Map<string, vscode.Range[]> {
    const fileComments = comments.filter((c) => c.path === relativePath);

    // Fingerprint check — skip re-render if data hasn't changed
    const fpKey = Object.entries(uriMap).map(([s, u]) => `${u.toString()}:${s}`).join('|');
    const newFingerprint = JSON.stringify(
      fileComments.map((c) => ({ id: c.id, body: c.body, updatedAt: c.updatedAt })).sort((a, b) => a.id - b.id)
    );
    if (this.renderedFingerprints.get(fpKey) === newFingerprint) {
      debug('Thread sync: skipping re-render for', relativePath, '— data unchanged');
      return null;
    }
    this.renderedFingerprints.set(fpKey, newFingerprint);
    this.evictIfNeeded(this.renderedFingerprints);

    // Clear threads on all URIs in the map
    for (const uri of Object.values(uriMap)) {
      this.commentController.clearThreads(uri);
      this.anchorTracker?.reset(uri);
    }

    debug('Thread sync:', fileComments.length, 'comments for', relativePath);

    // Separate root comments from replies
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
    const rangesByUri = new Map<string, vscode.Range[]>();

    for (const root of rootComments) {
      // Determine which URI this thread belongs on
      const commentSide = normalizeSide(root.side);
      const threadUri = uriMap[commentSide];
      // Skip comments whose side has no URI in the map
      // (e.g., LEFT comments in single-file view where only RIGHT URI exists)
      if (!threadUri) continue;
      const uriKey = threadUri.toString();

      const parsed = parseGnComment(root.body);
      const replies = repliesByParent.get(root.id) ?? [];

      if (parsed) {
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

        const thread = this.commentController.createThread(threadUri, range, threadComments, gnThreads, root.id);
        this.anchorTracker?.registerThread(threadUri, line, thread);
        const existing = rangesByUri.get(uriKey) ?? [];
        existing.push(range);
        rangesByUri.set(uriKey, existing);
        gnThreads++;
      } else {
        const line = (root.line ?? 1) - 1;
        const range = new vscode.Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER);

        const threadComments = [
          { body: root.body, author: root.userLogin ?? 'unknown' },
        ];
        for (const reply of replies) {
          threadComments.push({ body: reply.body, author: reply.userLogin ?? 'unknown' });
        }

        const thread = this.commentController.createThread(threadUri, range, threadComments, undefined, root.id);
        this.anchorTracker?.registerThread(threadUri, line, thread);
        lineThreads++;
      }

      threadsCreated++;
    }

    debug('Thread sync: created', threadsCreated, 'threads (' + gnThreads, '^gn +', lineThreads, 'line)');
    return rangesByUri;
  }

  getCachedComments(pr: PullRequestInfo): ReviewComment[] | undefined {
    const cacheKey = `${pr.owner}/${pr.repo}#${pr.number}`;
    return this.cache.get(cacheKey);
  }

  async syncForDocumentCacheFirst(
    uri: vscode.Uri,
    relativePath: string,
    pr: PullRequestInfo
  ): Promise<vscode.Range[] | null> {
    const cached = this.getCachedComments(pr);
    if (!cached) {
      this.log?.info('ThreadSync', 'cache miss — fetching from API');
      debug('Thread sync (cache-first): no cache — falling back to normal sync');
      return this.syncForDocument(uri, relativePath, pr);
    }

    // Render from cache immediately (may return null if fingerprint matches)
    this.log?.info('ThreadSync', 'cache hit — rendering from cache');
    debug('Thread sync (cache-first): rendering from cache');
    const cachedMap = this.renderComments(relativePath, cached, { RIGHT: uri });
    const cacheSkipped = cachedMap === null;
    const cachedRanges = cacheSkipped ? null : (cachedMap.get(uri.toString()) ?? []);

    // Fetch fresh data in background
    debug('Thread sync (cache-first): fetching fresh data');
    const cacheKey = `${pr.owner}/${pr.repo}#${pr.number}`;
    let freshComments: ReviewComment[] | null;
    try {
      freshComments = await this.prService.listReviewComments(pr);
    } catch (err) {
      await this.handleFetchError(err);
      return cachedRanges;
    }

    // null means 304 Not Modified — data unchanged, keep cache
    if (freshComments === null) {
      debug('Thread sync (cache-first): 304 not modified — skipping re-render');
      return cachedRanges;
    }

    // Compare: if data changed, re-render (clear fingerprint for the new data)
    const fingerprint = (comments: ReviewComment[]) =>
      JSON.stringify(
        comments
          .map((c) => ({ id: c.id, body: c.body, updatedAt: c.updatedAt }))
          .sort((a, b) => a.id - b.id)
      );
    const cacheFingerprint = fingerprint(cached);
    const freshFingerprint = fingerprint(freshComments);

    if (cacheFingerprint !== freshFingerprint) {
      debug('Thread sync (cache-first): data changed — re-rendering');
      this.cache.set(cacheKey, freshComments);
      this.evictIfNeeded(this.cache);
      const fpKey = `${uri.toString()}:RIGHT`;
      this.renderedFingerprints.delete(fpKey);
      const freshMap = this.renderComments(relativePath, freshComments, { RIGHT: uri });
      if (freshMap === null) return null;
      return freshMap.get(uri.toString()) ?? [];
    }

    debug('Thread sync (cache-first): data unchanged — skipping re-render');
    this.cache.set(cacheKey, freshComments);
    this.evictIfNeeded(this.cache);
    return cachedRanges;
  }

  startPolling(uri: vscode.Uri, relativePath: string, pr: PullRequestInfo): void {
    this.stopPolling();
    this.currentPr = pr;
    this.currentUri = uri;
    this.currentRelativePath = relativePath;

    const intervalMs = this.getPollingInterval();
    this.pollingTimer = setInterval(() => {
      this.pollOnce();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.currentPr = null;
    this.currentUri = null;
    this.currentRelativePath = null;
  }

  get isPolling(): boolean {
    return this.pollingTimer !== null;
  }

  dispose(): void {
    this.stopPolling();
  }

  invalidateCache(): void {
    this.cache.clear();
    this.renderedFingerprints.clear();
  }

  private async handleFetchError(err: unknown): Promise<void> {
    const status =
      err instanceof Error && 'status' in err
        ? (err as Error & { status: number }).status
        : undefined;
    if (status === 401 || status === 403) {
      await showAuthError();
    } else {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch PR comments.';
      await showApiError(message);
    }
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
    this.evictIfNeeded(this.cache);
    return comments;
  }

  private async pollOnce(): Promise<void> {
    if (!this.currentPr || !this.currentUri || !this.currentRelativePath) return;

    try {
      await this.syncForDocumentCacheFirst(
        this.currentUri,
        this.currentRelativePath,
        this.currentPr
      );
    } catch (err) {
      debug('Polling error (suppressed):', err instanceof Error ? err.message : err);
    }
  }

  private getPollingInterval(): number {
    const config = vscode.workspace.getConfiguration('gitnotate');
    const seconds = config.get<number>('pollInterval', 30);
    return Math.max(10, seconds) * 1000;
  }

  private evictIfNeeded<V>(map: Map<string, V>): void {
    while (map.size > MAX_CACHE_SIZE) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
  }
}
