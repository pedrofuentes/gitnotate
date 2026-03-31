export interface PullRequestInfo {
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}

const BASE_URL = 'https://api.github.com';

export class GitHubApiClient {
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
  ): Promise<boolean> {
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
        return false;
      }

      console.log('[Gitnotate] createReviewComment succeeded:', response.status);
      return true;
    } catch (err) {
      console.error('[Gitnotate] createReviewComment failed:', err);
      return false;
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
