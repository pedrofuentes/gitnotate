export interface PullRequestInfo {
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}

const BASE_URL = 'https://api.github.com';

export class PrService {
  constructor(private token: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
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
        return { ok: false, userMessage: this.parseApiError(response.status, errorBody) };
      }

      console.log('[Gitnotate] createReviewComment succeeded:', response.status);
      return { ok: true };
    } catch (err) {
      console.error('[Gitnotate] createReviewComment failed:', err);
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

  async listReviewComments(
    pr: PullRequestInfo
  ): Promise<Array<{ body: string; path: string; line: number }>> {
    try {
      const response = await fetch(
        `${BASE_URL}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`,
        {
          method: 'GET',
          headers: this.headers(),
        }
      );

      if (!response.ok) {
        console.error('[Gitnotate] listReviewComments failed:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      return (data as Array<{ body: string; path: string; line: number }>).map(
        (c) => ({
          body: c.body,
          path: c.path,
          line: c.line,
        })
      );
    } catch (err) {
      console.error('[Gitnotate] listReviewComments failed:', err);
      return [];
    }
  }
}
