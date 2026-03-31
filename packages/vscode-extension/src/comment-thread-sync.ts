import * as vscode from 'vscode';
import { parseGnComment } from '@gitnotate/core';
import type { PrService, PullRequestInfo, ReviewComment } from './pr-service';
import type { CommentController } from './comment-controller';
import { debug } from './logger';

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
  ): Promise<void> {
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
    let skippedNonGn = 0;

    for (const root of rootComments) {
      const parsed = parseGnComment(root.body);
      if (!parsed) {
        skippedNonGn++;
        continue;
      }

      const { metadata, userComment } = parsed;
      // GitHub uses 1-indexed lines; VSCode uses 0-indexed
      const line = metadata.lineNumber - 1;
      const range = new vscode.Range(line, metadata.start, line, metadata.end);

      const threadComments = [
        {
          body: userComment,
          author: root.userLogin ?? 'unknown',
        },
      ];

      const replies = repliesByParent.get(root.id) ?? [];
      for (const reply of replies) {
        threadComments.push({
          body: reply.body,
          author: reply.userLogin ?? 'unknown',
        });
      }

      this.commentController.createThread(uri, range, threadComments);
      threadsCreated++;
    }

    debug('Thread sync: created', threadsCreated, 'threads, skipped', skippedNonGn, 'non-^gn comments');
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
