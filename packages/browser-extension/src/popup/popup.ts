import {
  getAllEnabledRepos,
  getAllBlockedRepos,
  disableRepo,
  unblockRepo,
} from '../storage/repo-settings.js';
import {
  getHighlightStyle,
  setHighlightStyle,
  type HighlightStyle,
} from '../storage/highlight-style.js';

// --- Enabled repos ---

async function renderEnabledRepos(): Promise<void> {
  const container = document.getElementById('gn-repo-list');
  if (!container) return;

  const repos = await getAllEnabledRepos();

  container.innerHTML = '';

  if (repos.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'gn-muted';
    msg.textContent = 'No repos enabled yet. Visit a PR and click "Enable" when prompted.';
    container.appendChild(msg);
  } else {
    const list = document.createElement('ul');
    list.className = 'gn-repo-list';

    for (const repo of repos) {
      const li = document.createElement('li');
      li.className = 'gn-repo-item';

      const name = document.createElement('span');
      name.textContent = repo;

      const btn = document.createElement('button');
      btn.className = 'gn-btn gn-btn-small';
      btn.textContent = 'Disable';
      btn.addEventListener('click', async () => {
        const [owner, repoName] = repo.split('/');
        await disableRepo(owner, repoName);
        await renderEnabledRepos();
      });

      li.appendChild(name);
      li.appendChild(btn);
      list.appendChild(li);
    }
    container.appendChild(list);
  }
}

async function renderBlockedRepos(): Promise<void> {
  const container = document.getElementById('gn-blocked-list');
  if (!container) return;

  const repos = await getAllBlockedRepos();

  container.innerHTML = '';

  if (repos.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'gn-muted';
    msg.textContent = 'No blocked repos.';
    container.appendChild(msg);
  } else {
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
      btn.addEventListener('click', async () => {
        const [owner, repoName] = repo.split('/');
        await unblockRepo(owner, repoName);
        await renderBlockedRepos();
      });

      li.appendChild(name);
      li.appendChild(btn);
      list.appendChild(li);
    }
    container.appendChild(list);
  }
}

// --- Highlight style ---

async function renderHighlightStyle(): Promise<void> {
  const select = document.getElementById('gn-style-select') as HTMLSelectElement | null;
  if (!select) return;

  const current = await getHighlightStyle();
  select.value = current;

  select.addEventListener('change', async () => {
    await setHighlightStyle(select.value as HighlightStyle);
  });
}

// --- Bootstrap ---

async function init(): Promise<void> {
  await renderEnabledRepos();
  await renderBlockedRepos();
  await renderHighlightStyle();
}

init().catch(console.error);
