import { getAllEnabledRepos } from '../storage/repo-settings.js';
import { getAuthState, setToken, clearToken } from '../auth/oauth.js';

// --- Auth UI ---

async function renderAuthState(): Promise<void> {
  const signedOut = document.getElementById('gn-auth-signed-out');
  const signedIn = document.getElementById('gn-auth-signed-in');
  if (!signedOut || !signedIn) return;

  const state = await getAuthState();

  if (state.token) {
    signedOut.hidden = true;
    signedIn.hidden = false;

    const usernameEl = document.getElementById('gn-username');
    if (usernameEl) usernameEl.textContent = `@${state.username}`;

    const scopesEl = document.getElementById('gn-scopes');
    if (scopesEl) {
      scopesEl.textContent =
        state.scopes.length > 0
          ? `Scopes: ${state.scopes.join(', ')}`
          : 'No scopes';
    }
  } else {
    signedOut.hidden = false;
    signedIn.hidden = true;
  }
}

function setupAuthListeners(): void {
  const saveBtn = document.getElementById('gn-pat-save');
  const input = document.getElementById('gn-pat-input') as HTMLInputElement | null;
  const errorEl = document.getElementById('gn-auth-error');
  const signOutBtn = document.getElementById('gn-sign-out');

  saveBtn?.addEventListener('click', async () => {
    if (!input || !errorEl) return;

    const token = input.value.trim();
    if (!token) {
      errorEl.textContent = 'Please enter a token';
      errorEl.hidden = false;
      return;
    }

    saveBtn.setAttribute('disabled', '');
    errorEl.hidden = true;

    try {
      await setToken(token);
      input.value = '';
      await renderAuthState();
    } catch {
      errorEl.textContent = 'Invalid token — could not authenticate';
      errorEl.hidden = false;
    } finally {
      saveBtn.removeAttribute('disabled');
    }
  });

  signOutBtn?.addEventListener('click', async () => {
    await clearToken();
    await renderAuthState();
  });
}

// --- Enabled repos ---

async function renderEnabledRepos(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const repos = await getAllEnabledRepos();

  const existing = app.querySelector('#gn-repo-list');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'gn-repo-list';

  if (repos.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No repos enabled yet';
    container.appendChild(msg);
  } else {
    const heading = document.createElement('h2');
    heading.textContent = 'Enabled repos';
    heading.style.fontSize = '14px';
    heading.style.margin = '12px 0 8px';
    container.appendChild(heading);

    const list = document.createElement('ul');
    list.style.margin = '0';
    list.style.paddingLeft = '18px';
    list.style.fontSize = '13px';

    for (const repo of repos) {
      const li = document.createElement('li');
      li.textContent = repo;
      list.appendChild(li);
    }
    container.appendChild(list);
  }

  app.appendChild(container);
}

// --- Bootstrap ---

async function init(): Promise<void> {
  setupAuthListeners();
  await renderAuthState();
  await renderEnabledRepos();
}

init().catch(console.error);
