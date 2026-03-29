import { createGitHubApiClient } from '../auth/github-api-client';
import { validateSidecarFile } from '@gitnotate/core';
import type { SidecarFile } from '@gitnotate/core';

function sidecarPath(owner: string, repo: string, filePath: string): string {
  return `/repos/${owner}/${repo}/contents/.comments/${filePath}.json`;
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
    path += `?ref=${encodeURIComponent(ref)}`;
  }

  const response = await client.get(path);
  if (!response.ok) return null;

  try {
    const data = await response.json();
    if (!data.content) return null;
    const decoded = fromBase64(data.content);
    const parsed = JSON.parse(decoded);
    const validation = validateSidecarFile(parsed);
    if (!validation.valid) return null;
    return parsed as SidecarFile;
  } catch {
    return null;
  }
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
    content: toBase64(JSON.stringify(sidecar, null, 2)),
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await client.put(path, body);
  return response.ok;
}
