import type { PullRequestInfo } from './github-api';
import { exec as execCallback } from 'child_process';

function exec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execCallback(command, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(typeof result === 'string' ? result : result.stdout);
    });
  });
}

function parseGitHubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(
    /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  return null;
}

export async function detectCurrentPR(): Promise<PullRequestInfo | null> {
  try {
    const branch = (await exec('git rev-parse --abbrev-ref HEAD')).trim();

    // Skip default branches
    if (branch === 'main' || branch === 'master') {
      return null;
    }

    const remoteUrl = (await exec('git remote get-url origin')).trim();
    const remote = parseGitHubRemote(remoteUrl);
    if (!remote) {
      return null;
    }

    const response = await fetch(
      `https://api.github.com/repos/${remote.owner}/${remote.repo}/pulls?head=${remote.owner}:${branch}&state=open`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const prs = await response.json();
    if (!Array.isArray(prs) || prs.length === 0) {
      return null;
    }

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
