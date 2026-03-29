import {
  getAllEnabledRepos,
  getAllBlockedRepos,
  disableRepo,
  unblockRepo,
  isRepoEnabled,
  isRepoBlocked,
} from '../storage/repo-settings.js';
import {
  getHighlightStyle,
  setHighlightStyle,
  type HighlightStyle,
} from '../storage/highlight-style.js';

const REPO_ICON_SVG = '<svg class="repo-icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>';

// --- Status badge ---

function parseGitHubUrl(url: string): { owner: string; repo: string; isPrFiles: boolean } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const isPrFiles = parts.length >= 4 && parts[2] === 'pull'
      && (parts.length === 4 || parts[4] === 'files' || parts[4] === 'changes');
    return { owner: parts[0], repo: parts[1], isPrFiles };
  } catch {
    return null;
  }
}

async function renderStatus(): Promise<void> {
  const badge = document.getElementById('gn-status');
  const textEl = document.getElementById('gn-status-text');
  const dotEl = badge?.querySelector('.status-dot') as HTMLElement | null;
  if (!badge || !textEl) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      textEl.textContent = 'Ready';
      return;
    }

    const info = parseGitHubUrl(tab.url);
    if (!info) {
      textEl.textContent = 'Not GitHub';
      badge.className = 'status-badge status-not-github';
      if (dotEl) dotEl.className = 'status-dot not-github';
      return;
    }

    const blocked = await isRepoBlocked(info.owner, info.repo);
    if (blocked) {
      textEl.textContent = 'Disabled';
      badge.className = 'status-badge status-disabled';
      if (dotEl) dotEl.className = 'status-dot disabled';
      return;
    }

    const enabled = await isRepoEnabled(info.owner, info.repo);
    if (enabled && info.isPrFiles) {
      textEl.textContent = 'Active';
      badge.className = 'status-badge status-active';
      if (dotEl) dotEl.className = 'status-dot active';
    } else if (enabled) {
      textEl.textContent = 'Enabled';
      badge.className = 'status-badge status-enabled';
      if (dotEl) dotEl.className = 'status-dot enabled';
    } else {
      textEl.textContent = 'Available';
      badge.className = 'status-badge status-available';
      if (dotEl) dotEl.className = 'status-dot available';
    }
  } catch {
    textEl.textContent = 'Ready';
  }
}

// --- Active tab reload helper ---

async function reloadActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.reload(tab.id);
  } catch { /* ignore — may not have tab access */ }
}

function createRepoItem(
  repo: string,
  actionLabel: string,
  actionClass: string,
  onAction: () => Promise<void>,
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'repo-item';

  const [owner, repoName] = repo.split('/');
  const nameEl = document.createElement('span');
  nameEl.className = 'repo-name';
  nameEl.innerHTML = `${REPO_ICON_SVG} <span class="owner">${owner}</span><span class="slash">/</span>${repoName}`;

  const btn = document.createElement('button');
  btn.className = `repo-action ${actionClass}`;
  btn.textContent = actionLabel;
  btn.addEventListener('click', onAction);

  item.appendChild(nameEl);
  item.appendChild(btn);
  return item;
}

// --- Enabled repos ---

async function renderEnabledRepos(): Promise<void> {
  const container = document.getElementById('gn-repo-list');
  const countEl = document.getElementById('gn-enabled-count');
  if (!container) return;

  const repos = await getAllEnabledRepos();
  container.innerHTML = '';

  if (repos.length === 0) {
    if (countEl) countEl.hidden = true;
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span class="emoji">📂</span>No repos enabled yet.<br>Visit a PR and click "Enable" when prompted.';
    container.appendChild(empty);
  } else {
    if (countEl) {
      countEl.textContent = String(repos.length);
      countEl.hidden = false;
    }
    for (const repo of repos) {
      container.appendChild(
        createRepoItem(repo, 'Disable', '', async () => {
          const [owner, repoName] = repo.split('/');
          await disableRepo(owner, repoName);
          await renderEnabledRepos();
          await renderStatus();
          await reloadActiveTab();
        }),
      );
    }
  }
}

// --- Blocked repos ---

async function renderBlockedRepos(): Promise<void> {
  const container = document.getElementById('gn-blocked-list');
  const countEl = document.getElementById('gn-blocked-count');
  const section = document.getElementById('gn-blocked-section');
  if (!container) return;

  const repos = await getAllBlockedRepos();
  container.innerHTML = '';

  if (repos.length === 0) {
    if (section) section.hidden = true;
  } else {
    if (section) section.hidden = false;
    if (countEl) countEl.textContent = String(repos.length);
    for (const repo of repos) {
      container.appendChild(
        createRepoItem(repo, 'Unblock', 'unblock', async () => {
          const [owner, repoName] = repo.split('/');
          await unblockRepo(owner, repoName);
          await renderBlockedRepos();
          await renderStatus();
          await reloadActiveTab();
        }),
      );
    }
  }
}

// --- Highlight style ---

async function renderHighlightStyle(): Promise<void> {
  const picker = document.getElementById('gn-style-picker');
  if (!picker) return;

  const current = await getHighlightStyle();
  const options = picker.querySelectorAll('.style-option');

  for (const opt of options) {
    const style = opt.getAttribute('data-style');
    if (style === current) opt.classList.add('active');

    opt.addEventListener('click', async () => {
      for (const o of options) o.classList.remove('active');
      opt.classList.add('active');
      await setHighlightStyle(style as HighlightStyle);
      await reloadActiveTab();
    });
  }
}

// --- Bootstrap ---

async function init(): Promise<void> {
  await renderStatus();
  await renderEnabledRepos();
  await renderBlockedRepos();
  await renderHighlightStyle();
}

init().catch(console.error);
