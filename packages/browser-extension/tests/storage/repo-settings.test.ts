import { describe, it, expect, beforeEach } from 'vitest';
import {
  isRepoEnabled,
  enableRepo,
  disableRepo,
  getRepoSettings,
  getAllEnabledRepos,
  isRepoBlocked,
  blockRepo,
  unblockRepo,
  getAllBlockedRepos,
} from '../../src/storage/repo-settings.js';

// Mock chrome.storage.local for tests
let store: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys: string[] | null) => {
        if (keys === null) {
          return Promise.resolve({ ...store });
        }
        return Promise.resolve(
          Object.fromEntries(
            keys.filter((k) => k in store).map((k) => [k, store[k]])
          )
        );
      },
      set: (items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      },
      remove: (keys: string | string[]) => {
        const keysArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keysArr) {
          delete store[k];
        }
        return Promise.resolve();
      },
    },
  },
} as unknown as typeof chrome;

beforeEach(() => {
  store = {};
});

describe('repo-settings', () => {
  it('should return false for unknown repo (not enabled by default)', async () => {
    const result = await isRepoEnabled('owner', 'repo');
    expect(result).toBe(false);
  });

  it('should enable a repo', async () => {
    await enableRepo('owner', 'repo');
    const result = await isRepoEnabled('owner', 'repo');
    expect(result).toBe(true);
  });

  it('should disable a repo', async () => {
    await enableRepo('owner', 'repo');
    await disableRepo('owner', 'repo');
    const result = await isRepoEnabled('owner', 'repo');
    expect(result).toBe(false);
  });

  it('should return settings with timestamp after enabling', async () => {
    const before = new Date().toISOString();
    await enableRepo('owner', 'repo');
    const after = new Date().toISOString();

    const settings = await getRepoSettings('owner', 'repo');
    expect(settings).not.toBeNull();
    expect(settings!.enabled).toBe(true);
    expect(settings!.enabledAt).toBeDefined();
    expect(settings!.enabledAt! >= before).toBe(true);
    expect(settings!.enabledAt! <= after).toBe(true);
  });

  it('should list all enabled repos', async () => {
    await enableRepo('owner1', 'repo1');
    await enableRepo('owner2', 'repo2');
    await enableRepo('owner3', 'repo3');
    await disableRepo('owner2', 'repo2');

    const repos = await getAllEnabledRepos();
    expect(repos).toContain('owner1/repo1');
    expect(repos).toContain('owner3/repo3');
    expect(repos).not.toContain('owner2/repo2');
    expect(repos).toHaveLength(2);
  });

  it('should handle enabling the same repo twice (idempotent)', async () => {
    await enableRepo('owner', 'repo');
    const settings1 = await getRepoSettings('owner', 'repo');

    await enableRepo('owner', 'repo');
    const settings2 = await getRepoSettings('owner', 'repo');

    expect(settings2!.enabled).toBe(true);
    // Timestamp should be preserved from first enable
    expect(settings2!.enabledAt).toBe(settings1!.enabledAt);
  });

  it('should handle different repos independently', async () => {
    await enableRepo('owner', 'repo-a');
    await enableRepo('owner', 'repo-b');
    await disableRepo('owner', 'repo-a');

    expect(await isRepoEnabled('owner', 'repo-a')).toBe(false);
    expect(await isRepoEnabled('owner', 'repo-b')).toBe(true);
  });

  it('should return null for repo with no settings', async () => {
    const settings = await getRepoSettings('owner', 'nonexistent');
    expect(settings).toBeNull();
  });

  it('should block a repo', async () => {
    await blockRepo('owner', 'repo');
    expect(await isRepoBlocked('owner', 'repo')).toBe(true);
    expect(await isRepoEnabled('owner', 'repo')).toBe(false);
  });

  it('should unblock a repo (removes settings entirely)', async () => {
    await blockRepo('owner', 'repo');
    await unblockRepo('owner', 'repo');
    expect(await isRepoBlocked('owner', 'repo')).toBe(false);
    expect(await getRepoSettings('owner', 'repo')).toBeNull();
  });

  it('should return false for isRepoBlocked on unknown repo', async () => {
    expect(await isRepoBlocked('owner', 'unknown')).toBe(false);
  });

  it('should list all blocked repos', async () => {
    await blockRepo('owner1', 'repo1');
    await blockRepo('owner2', 'repo2');
    await enableRepo('owner3', 'repo3');

    const blocked = await getAllBlockedRepos();
    expect(blocked).toContain('owner1/repo1');
    expect(blocked).toContain('owner2/repo2');
    expect(blocked).not.toContain('owner3/repo3');
    expect(blocked).toHaveLength(2);
  });

  it('should not include blocked repos in enabled list', async () => {
    await enableRepo('owner', 'repo-a');
    await blockRepo('owner', 'repo-b');

    const enabled = await getAllEnabledRepos();
    expect(enabled).toContain('owner/repo-a');
    expect(enabled).not.toContain('owner/repo-b');
  });

  it('should allow blocking a previously enabled repo', async () => {
    await enableRepo('owner', 'repo');
    expect(await isRepoEnabled('owner', 'repo')).toBe(true);

    await blockRepo('owner', 'repo');
    expect(await isRepoEnabled('owner', 'repo')).toBe(false);
    expect(await isRepoBlocked('owner', 'repo')).toBe(true);
  });

  it('should allow enabling a previously blocked repo after unblocking', async () => {
    await blockRepo('owner', 'repo');
    await unblockRepo('owner', 'repo');
    await enableRepo('owner', 'repo');
    expect(await isRepoEnabled('owner', 'repo')).toBe(true);
    expect(await isRepoBlocked('owner', 'repo')).toBe(false);
  });
});
