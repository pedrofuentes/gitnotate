export interface RepoSettings {
  enabled: boolean;
  blocked?: boolean;
  enabledAt?: string; // ISO 8601 timestamp
}

function storageKey(owner: string, repo: string): string {
  return `repo:${owner}/${repo}`;
}

export async function getRepoSettings(
  owner: string,
  repo: string
): Promise<RepoSettings | null> {
  try {
    const key = storageKey(owner, repo);
    const result = await chrome.storage.local.get([key]);
    const settings = result[key] as RepoSettings | undefined;
    return settings ?? null;
  } catch (err) {
    console.error('[Gitnotate] Failed to read repo settings:', err);
    return null;
  }
}

export async function isRepoEnabled(
  owner: string,
  repo: string
): Promise<boolean> {
  const settings = await getRepoSettings(owner, repo);
  return settings?.enabled === true;
}

export async function enableRepo(
  owner: string,
  repo: string
): Promise<void> {
  try {
    const key = storageKey(owner, repo);
    const existing = await getRepoSettings(owner, repo);

    // Idempotent: preserve original timestamp if already enabled
    const enabledAt =
      existing?.enabled && existing.enabledAt
        ? existing.enabledAt
        : new Date().toISOString();

    const settings: RepoSettings = { enabled: true, enabledAt };
    await chrome.storage.local.set({ [key]: settings });
  } catch (err) {
    console.error('[Gitnotate] Failed to enable repo:', err);
  }
}

export async function disableRepo(
  owner: string,
  repo: string
): Promise<void> {
  try {
    const key = storageKey(owner, repo);
    const existing = await getRepoSettings(owner, repo);

    const settings: RepoSettings = {
      enabled: false,
      enabledAt: existing?.enabledAt,
    };
    await chrome.storage.local.set({ [key]: settings });
  } catch (err) {
    console.error('[Gitnotate] Failed to disable repo:', err);
  }
}

export async function getAllEnabledRepos(): Promise<string[]> {
  try {
    const allItems = await chrome.storage.local.get(null);
    const prefix = 'repo:';
    const enabled: string[] = [];

    for (const [key, value] of Object.entries(allItems)) {
      if (key.startsWith(prefix)) {
        const settings = value as RepoSettings;
        if (settings.enabled) {
          enabled.push(key.slice(prefix.length));
        }
      }
    }

    return enabled;
  } catch (err) {
    console.error('[Gitnotate] Failed to list enabled repos:', err);
    return [];
  }
}

export async function isRepoBlocked(
  owner: string,
  repo: string,
): Promise<boolean> {
  const settings = await getRepoSettings(owner, repo);
  return settings?.blocked === true;
}

export async function blockRepo(
  owner: string,
  repo: string,
): Promise<void> {
  try {
    const key = storageKey(owner, repo);
    const settings: RepoSettings = { enabled: false, blocked: true };
    await chrome.storage.local.set({ [key]: settings });
  } catch (err) {
    console.error('[Gitnotate] Failed to block repo:', err);
  }
}

export async function unblockRepo(
  owner: string,
  repo: string,
): Promise<void> {
  try {
    const key = storageKey(owner, repo);
    await chrome.storage.local.remove(key);
  } catch (err) {
    console.error('[Gitnotate] Failed to unblock repo:', err);
  }
}

export async function getAllBlockedRepos(): Promise<string[]> {
  try {
    const allItems = await chrome.storage.local.get(null);
    const prefix = 'repo:';
    const blocked: string[] = [];

    for (const [key, value] of Object.entries(allItems)) {
      if (key.startsWith(prefix)) {
        const settings = value as RepoSettings;
        if (settings.blocked) {
          blocked.push(key.slice(prefix.length));
        }
      }
    }

    return blocked;
  } catch (err) {
    console.error('[Gitnotate] Failed to list blocked repos:', err);
    return [];
  }
}
