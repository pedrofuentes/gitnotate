import { GitService } from './git-service';
import type { PullRequestInfo } from './github-api';

const REQUEST_TIMEOUT_MS = 10_000;

export async function detectCurrentPR(
  gitService: GitService,
  token?: string
): Promise<PullRequestInfo | null> {
  try {
    if (!gitService.isAvailable()) return null;

    const branch = gitService.getCurrentBranch();
    if (!branch || gitService.isDefaultBranch()) return null;

    const remoteUrl = gitService.getRemoteUrl();
    if (!remoteUrl) return null;

    const remote = gitService.parseGitHubOwnerRepo(remoteUrl);
    if (!remote) return null;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(remote.owner)}/${encodeURIComponent(remote.repo)}/pulls?head=${encodeURIComponent(remote.owner)}:${encodeURIComponent(branch)}&state=open`,
      {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (response.status === 403 || response.status === 429) {
      console.warn('[Gitnotate] GitHub API rate limit exceeded');
      return null;
    }

    if (!response.ok) return null;

    const prs = await response.json();
    if (!Array.isArray(prs) || prs.length === 0) return null;

    const pr = prs[0];
    return {
      owner: remote.owner,
      repo: remote.repo,
      number: pr.number,
      headSha: pr.head.sha,
    };
  } catch (err) {
    console.error('[Gitnotate] detectCurrentPR failed:', err);
    return null;
  }
}
