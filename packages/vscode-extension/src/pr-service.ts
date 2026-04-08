import * as vscode from 'vscode';
import { getLogger, Logger } from './logger';

export interface PullRequestInfo {
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}

export interface ReviewComment {
  id: number;
  body: string;
  path: string;
  line: number;
  side: string;
  inReplyToId: number | undefined;
  userLogin: string | undefined;
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = 'https://api.github.com';
const PER_PAGE = 100;
const MAX_PAGES = 10;

export class PrService {
  private log: Logger | undefined;
  private etagCache: Map<string, string> = new Map();

  constructor(private token: string) {
    try { this.log = getLogger(); } catch { /* logger not initialized */ }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
  }

  clearEtagCache(): void {
    this.etagCache.clear();
  }

  async createReviewComment(
    pr: PullRequestInfo,
    filePath: string,
    line: number,
    side: 'LEFT' | 'RIGHT',
    body: string
  ): Promise<{ ok: boolean; userMessage?: string }> {
    const url = `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`;
    const payload = {
      body,
      commit_id: pr.headSha,
      path: filePath,
      line,
      side,
    };

    try {
      this.log?.info('PrService', 'POST', url);
      console.log('[Gitnotate] POST', url);
      console.log('[Gitnotate] Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(could not read body)');
        console.error('[Gitnotate] createReviewComment failed:', response.status, response.statusText);
        console.error('[Gitnotate] Response body:', errorBody);
        this.log?.error('PrService', 'createReviewComment failed:', response.status, response.statusText);
        return { ok: false, userMessage: this.parseApiError(response.status, errorBody) };
      }

      console.log('[Gitnotate] createReviewComment succeeded:', response.status);
      this.log?.info('PrService', 'createReviewComment succeeded:', response.status);
      return { ok: true };
    } catch (err) {
      console.error('[Gitnotate] createReviewComment failed:', err);
      this.log?.error('PrService', 'createReviewComment network error:', err);
      return { ok: false, userMessage: 'Network error — check your connection and try again.' };
    }
  }

  private parseApiError(status: number, body: string): string {
    try {
      const parsed = JSON.parse(body);
      const errors: Array<{ message?: string }> = parsed.errors ?? [];
      const firstError = errors[0]?.message ?? parsed.message ?? '';

      if (firstError.includes('pending review')) {
        return 'You have a pending PR review. Submit or discard it on GitHub, then try again.';
      }
      if (firstError.includes('commit_id') || firstError.includes('No commit found')) {
        return 'The branch is out of sync with the PR. Push your latest changes or pull the PR head commit.';
      }
      if (firstError.includes('path')) {
        return `File not found in the PR diff. Make sure "${firstError}" is part of this PR's changes.`;
      }
      if (status === 403) {
        return 'Permission denied. You may not have write access to this repository.';
      }
      if (status === 404) {
        return 'PR not found. It may have been closed or merged.';
      }

      return `GitHub API error (${status}): ${firstError || body}`;
    } catch {
      return `GitHub API error (${status}). Check the Debug Console for details.`;
    }
  }

  async createReviewWithComment(
    pr: PullRequestInfo,
    path: string,
    line: number,
    side: 'LEFT' | 'RIGHT',
    body: string
  ): Promise<{ ok: true; id: number } | { ok: false; userMessage: string }> {
    const url = `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`;
    const payload = {
      commit_id: pr.headSha,
      event: 'COMMENT',
      comments: [{ path, line, side, body }],
    };

    try {
      console.log('[Gitnotate] POST (review)', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(could not read body)');
        console.error('[Gitnotate] createReviewWithComment failed:', response.status, response.statusText);
        console.error('[Gitnotate] Response body:', errorBody);

        // If a pending review exists, we cannot add comments to it via REST API
        // (GitHub API limitation — no endpoint for appending to pending reviews)
        if (response.status === 422 && errorBody.includes('pending review')) {
          console.log('[Gitnotate] Pending review detected — cannot post while a review is pending');
          return {
            ok: false,
            userMessage: 'Cannot post comment: you have a pending review on this PR. Submit or discard it first on github.com, then try again.',
          };
        }

        return { ok: false, userMessage: this.parseApiError(response.status, errorBody) };
      }

      const data = (await response.json()) as { id: number };
      console.log('[Gitnotate] createReviewWithComment succeeded:', response.status);
      return { ok: true, id: data.id };
    } catch (err) {
      console.error('[Gitnotate] createReviewWithComment failed:', err);
      return { ok: false, userMessage: 'Network error — check your connection and try again.' };
    }
  }

  async createReplyComment(
    pr: PullRequestInfo,
    body: string,
    inReplyToId: number
  ): Promise<{ ok: true; id: number } | { ok: false; userMessage: string }> {
    // GitHub REST API: POST /repos/{owner}/{repo}/pulls/{pull_number}/comments
    // with { body, in_reply_to: commentId } — "in_reply_to" (not "in_reply_to_id")
    // When in_reply_to is specified, all other parameters except body are ignored.
    const url = `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`;
    const payload = { body, in_reply_to: inReplyToId };

    try {
      console.log('[Gitnotate] POST (reply)', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(could not read body)');
        console.error('[Gitnotate] createReplyComment failed:', response.status, response.statusText);
        console.error('[Gitnotate] Response body:', errorBody);
        return { ok: false, userMessage: this.parseApiError(response.status, errorBody) };
      }

      const data = (await response.json()) as { id: number };
      console.log('[Gitnotate] createReplyComment succeeded:', response.status);
      return { ok: true, id: data.id };
    } catch (err) {
      console.error('[Gitnotate] createReplyComment failed:', err);
      return { ok: false, userMessage: 'Network error — check your connection and try again.' };
    }
  }

  async listReviewComments(
    pr: PullRequestInfo
  ): Promise<ReviewComment[] | null> {
    const allComments: ReviewComment[] = [];
    let page = 1;
    const cacheKey = `comments:${pr.owner}/${pr.repo}#${pr.number}`;

    try {
      while (page <= MAX_PAGES) {
        const url = `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments?per_page=${PER_PAGE}&page=${page}`;
        this.log?.info('PrService', 'GET', url);
        console.log('[Gitnotate] GET', url);

        const reqHeaders: Record<string, string> = this.headers();

        // Only send If-None-Match on page 1
        if (page === 1) {
          const cachedEtag = this.etagCache.get(cacheKey);
          if (cachedEtag) {
            reqHeaders['If-None-Match'] = cachedEtag;
          }
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: reqHeaders,
        });

        if (page === 1 && response.status === 304) {
          return null;
        }

        if (!response.ok) {
          console.error('[Gitnotate] listReviewComments failed:', response.status, response.statusText);
          this.log?.error('PrService', 'listReviewComments failed:', response.status);
          return allComments;
        }

        // Store ETag from page 1
        if (page === 1) {
          const etag = response.headers.get('ETag') ?? response.headers.get('etag');
          if (etag) {
            this.etagCache.set(cacheKey, etag);
          }
        }

        const data = (await response.json()) as Array<{
          id: number;
          body: string;
          path: string;
          line: number;
          side: string;
          in_reply_to_id?: number;
          user?: { login: string } | null;
          created_at: string;
          updated_at: string;
        }>;

        for (const c of data) {
          allComments.push({
            id: c.id,
            body: c.body,
            path: c.path,
            line: c.line,
            side: c.side,
            inReplyToId: c.in_reply_to_id,
            userLogin: c.user?.login,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          });
        }

        if (data.length < PER_PAGE) break;
        page++;
      }

      if (page > MAX_PAGES) {
        const msg = `PR has more than ${MAX_PAGES * PER_PAGE} comments. Some comments may not be displayed.`;
        console.warn('[Gitnotate]', `MAX_PAGES (${MAX_PAGES}) reached — returning ${allComments.length} comments, some may be missing`);
        this.log?.warn('PrService', msg);
        vscode.window.showInformationMessage(`Gitnotate: ${msg}`);
      }

      return allComments;
    } catch (err) {
      console.error('[Gitnotate] listReviewComments failed:', err);
      this.log?.error('PrService', 'listReviewComments network error:', err);
      return [];
    }
  }
}
