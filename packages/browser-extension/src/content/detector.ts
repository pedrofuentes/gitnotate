export type GitHubPageType =
  | 'pr-files-changed'
  | 'pr-conversation'
  | 'file-view'
  | 'other';

export interface GitHubPageInfo {
  type: GitHubPageType;
  owner: string;
  repo: string;
  prNumber?: number;
  filePath?: string;
  branch?: string;
}

const GITHUB_HOST = 'github.com';

const PR_FILES_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/files\/?$/;
const PR_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(\/.*)?$/;
const BLOB_RE = /^\/([^/]+)\/([^/]+)\/blob\/([^/]+?)\/(.+)$/;

function otherPage(owner = '', repo = ''): GitHubPageInfo {
  return { type: 'other', owner, repo };
}

export function detectGitHubPage(): GitHubPageInfo {
  const { hostname, pathname } = window.location;

  if (hostname !== GITHUB_HOST) {
    return otherPage();
  }

  // Extract owner/repo from first two path segments
  const segments = pathname.split('/').filter(Boolean);
  const owner = segments[0] ?? '';
  const repo = segments[1] ?? '';

  // PR Files Changed: /owner/repo/pull/{number}/files
  const prFilesMatch = pathname.match(PR_FILES_RE);
  if (prFilesMatch) {
    return {
      type: 'pr-files-changed',
      owner: prFilesMatch[1],
      repo: prFilesMatch[2],
      prNumber: Number(prFilesMatch[3]),
    };
  }

  // PR page (conversation, commits, checks, etc.)
  const prMatch = pathname.match(PR_RE);
  if (prMatch) {
    return {
      type: 'pr-conversation',
      owner: prMatch[1],
      repo: prMatch[2],
      prNumber: Number(prMatch[3]),
    };
  }

  // File view: /owner/repo/blob/{branch}/{path}
  const blobMatch = pathname.match(BLOB_RE);
  if (blobMatch) {
    return {
      type: 'file-view',
      owner: blobMatch[1],
      repo: blobMatch[2],
      branch: blobMatch[3],
      filePath: blobMatch[4],
    };
  }

  return otherPage(owner, repo);
}
