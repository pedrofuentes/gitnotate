import { GitService } from './git-service';
import { debug, warn, error as logError } from './logger';
<<<<<<< HEAD
import type { PullRequestInfo } from './github-api';
=======
import type { PullRequestInfo } from './pr-service';
>>>>>>> feature/comment-controller-thread-sync

const REQUEST_TIMEOUT_MS = 10_000;

export async function detectCurrentPR(
  gitService: GitService,
  token?: string
): Promise<PullRequestInfo | null> {
  try {
    if (!gitService.isAvailable()) {
      debug('PR detection: git not available');
      return null;
    }

    const branch = gitService.getCurrentBranch();
    if (!branch || gitService.isDefaultBranch()) return null;

    const remoteUrl = gitService.getRemoteUrl();
    if (!remoteUrl) {
      debug('PR detection: no remote URL found');
      return null;
    }

    const remote = gitService.parseGitHubOwnerRepo(remoteUrl);
    if (!remote) return null;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(remote.owner)}/${encodeURIComponent(remote.repo)}/pulls?head=${encodeURIComponent(remote.owner)}:${encodeURIComponent(branch)}&state=open`;
    debug('PR detection: fetching', url, token ? '(authenticated)' : '(unauthenticated)');

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 403 || response.status === 429) {
      warn('GitHub API rate limit exceeded');
      return null;
    }

    if (!response.ok) {
      debug('PR detection: API returned', response.status);
      return null;
    }

    const prs = await response.json();
    if (!Array.isArray(prs) || prs.length === 0) {
      debug('PR detection: no open PRs for branch', branch);
      return null;
    }

    const pr = prs[0];
    debug('PR detection: found PR #' + pr.number, `(${remote.owner}/${remote.repo})`);
    return {
      owner: remote.owner,
      repo: remote.repo,
      number: pr.number,
      headSha: pr.head.sha,
    };
  } catch (err) {
    logError('detectCurrentPR failed:', err);
    return null;
  }
}
