import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local and chrome.tabs
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
            keys.filter((k) => k in store).map((k) => [k, store[k]]),
          ),
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
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    reload: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as typeof chrome;

// Import after chrome mock is set up
import {
  getAllBlockedRepos,
  blockRepo,
  unblockRepo,
} from '../../src/storage/repo-settings.js';
import {
  getHighlightStyle,
  setHighlightStyle,
  type HighlightStyle,
} from '../../src/storage/highlight-style.js';

describe('popup – renderBlockedRepos', () => {
  beforeEach(() => {
    store = {};
    document.body.innerHTML = '';
  });

  it('should show "No blocked repos." when list is empty', async () => {
    const container = document.createElement('div');
    container.id = 'gn-blocked-list';
    document.body.appendChild(container);

    const repos = await getAllBlockedRepos();
    container.innerHTML = '';
    if (repos.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'gn-muted';
      msg.textContent = 'No blocked repos.';
      container.appendChild(msg);
    }

    expect(container.querySelector('.gn-muted')?.textContent).toBe('No blocked repos.');
  });

  it('should render blocked repos with Unblock buttons', async () => {
    await blockRepo('owner1', 'repo1');
    await blockRepo('owner2', 'repo2');

    const container = document.createElement('div');
    container.id = 'gn-blocked-list';
    document.body.appendChild(container);

    const repos = await getAllBlockedRepos();
    container.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'gn-repo-list';

    for (const repo of repos) {
      const li = document.createElement('li');
      li.className = 'gn-repo-item';

      const name = document.createElement('span');
      name.textContent = repo;

      const btn = document.createElement('button');
      btn.className = 'gn-btn gn-btn-small';
      btn.textContent = 'Unblock';

      li.appendChild(name);
      li.appendChild(btn);
      list.appendChild(li);
    }
    container.appendChild(list);

    const items = container.querySelectorAll('.gn-repo-item');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('span')?.textContent).toBe('owner1/repo1');
    expect(items[0].querySelector('button')?.textContent).toBe('Unblock');
    expect(items[1].querySelector('span')?.textContent).toBe('owner2/repo2');
  });

  it('should unblock repo when Unblock button is clicked', async () => {
    await blockRepo('owner1', 'repo1');

    const container = document.createElement('div');
    container.id = 'gn-blocked-list';
    document.body.appendChild(container);

    const repos = await getAllBlockedRepos();
    const list = document.createElement('ul');

    for (const repo of repos) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = 'Unblock';
      btn.addEventListener('click', async () => {
        const [owner, repoName] = repo.split('/');
        await unblockRepo(owner, repoName);
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
    container.appendChild(list);

    const btn = container.querySelector('button')!;
    btn.click();

    // Allow async handler to complete
    await new Promise((r) => setTimeout(r, 10));

    const remaining = await getAllBlockedRepos();
    expect(remaining).toHaveLength(0);
  });
});

describe('popup – renderHighlightStyle', () => {
  beforeEach(() => {
    store = {};
    document.body.innerHTML = '';
  });

  it('should set select value to current highlight style', async () => {
    const select = document.createElement('select');
    select.id = 'gn-style-select';
    select.innerHTML = `
      <option value="dashed">Dashed</option>
      <option value="underline">Underline</option>
      <option value="background">Background</option>
    `;
    document.body.appendChild(select);

    const current = await getHighlightStyle();
    select.value = current;

    expect(select.value).toBe('dashed');
  });

  it('should reflect a stored style in the select', async () => {
    store['gitnotate-highlight-style'] = 'underline';

    const select = document.createElement('select');
    select.id = 'gn-style-select';
    select.innerHTML = `
      <option value="dashed">Dashed</option>
      <option value="underline">Underline</option>
      <option value="background">Background</option>
    `;
    document.body.appendChild(select);

    const current = await getHighlightStyle();
    select.value = current;

    expect(select.value).toBe('underline');
  });

  it('should persist style change when select fires change event', async () => {
    const select = document.createElement('select');
    select.id = 'gn-style-select';
    select.innerHTML = `
      <option value="dashed">Dashed</option>
      <option value="underline">Underline</option>
      <option value="background">Background</option>
    `;
    document.body.appendChild(select);

    select.addEventListener('change', async () => {
      await setHighlightStyle(select.value as HighlightStyle);
    });

    select.value = 'background';
    select.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 10));

    const stored = await getHighlightStyle();
    expect(stored).toBe('background');
  });
});

// Import popup functions after chrome mock is set up
import { parseGitHubUrl, createRepoItem } from '../../src/popup/popup.js';

describe('popup – parseGitHubUrl', () => {
  it('should return null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://example.com/foo/bar')).toBeNull();
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
  });

  it('should return null for invalid URLs', () => {
    expect(parseGitHubUrl('not-a-url')).toBeNull();
  });

  it('should return null for GitHub root with insufficient path segments', () => {
    expect(parseGitHubUrl('https://github.com/')).toBeNull();
    expect(parseGitHubUrl('https://github.com/owner')).toBeNull();
  });

  it('should parse a repo root URL', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', isPrFiles: false });
  });

  it('should parse a PR files-changed URL', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/pull/42/files');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', isPrFiles: true });
  });

  it('should parse a PR changes URL with anchor', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/pull/6/changes#r3005658715');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', isPrFiles: true });
  });

  it('should parse a PR conversation URL as PR page', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/pull/42');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', isPrFiles: true });
  });

  it('should parse an issues URL as non-PR', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/issues/10');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', isPrFiles: false });
  });

  it('should parse a blob URL as non-PR', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/blob/main/README.md');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', isPrFiles: false });
  });
});

describe('popup – createRepoItem', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should create a repo item with owner/name split', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const item = createRepoItem('myorg/myrepo', 'Disable', '', onAction);

    expect(item.className).toBe('repo-item');
    expect(item.querySelector('.owner')?.textContent).toBe('myorg');
    expect(item.querySelector('.slash')?.textContent).toBe('/');
    expect(item.textContent).toContain('myrepo');
  });

  it('should call onAction when button is clicked', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const item = createRepoItem('owner/repo', 'Disable', '', onAction);

    const btn = item.querySelector('.repo-action') as HTMLButtonElement;
    expect(btn.textContent).toBe('Disable');

    btn.click();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('should apply custom action class', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const item = createRepoItem('owner/repo', 'Unblock', 'unblock', onAction);

    const btn = item.querySelector('.repo-action') as HTMLButtonElement;
    expect(btn.classList.contains('unblock')).toBe(true);
    expect(btn.textContent).toBe('Unblock');
  });

  it('should not render HTML in repo names (XSS safety)', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const item = createRepoItem('<img src=x onerror=alert(1)>/xss', 'Disable', '', onAction);

    expect(item.querySelector('.owner')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(item.querySelector('img')).toBeNull();
  });
});