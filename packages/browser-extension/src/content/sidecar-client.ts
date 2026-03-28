import { createGitHubApiClient } from '../auth/github-api-client';
import type { SidecarFile } from '@gitnotate/core';

function sidecarPath(owner: string, repo: string, filePath: string): string {
  return `/repos/${owner}/${repo}/contents/.comments/${filePath}.json`;
}

export async function readSidecarFile(
  owner: string,
  repo: string,
  filePath: string,
  ref?: string
): Promise<SidecarFile | null> {
  const client = await createGitHubApiClient();
  if (!client) return null;

  let path = sidecarPath(owner, repo, filePath);
  if (ref) {
    path += `?ref=${ref}`;
  }

  const response = await client.get(path);
  if (!response.ok) return null;

  const data = await response.json();
  return JSON.parse(atob(data.content)) as SidecarFile;
}

export async function writeSidecarFile(
  owner: string,
  repo: string,
  filePath: string,
  sidecar: SidecarFile,
  message?: string
): Promise<boolean> {
  const client = await createGitHubApiClient();
  if (!client) return false;

  const path = sidecarPath(owner, repo, filePath);

  // Check if file already exists to get its sha for updates
  let sha: string | undefined;
  const existing = await client.get(path);
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }

  const body: Record<string, unknown> = {
    message: message ?? `Update comments for ${filePath}`,
    content: btoa(JSON.stringify(sidecar, null, 2)),
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await client.put(path, body);
  return response.ok;
}
