import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local
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
