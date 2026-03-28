import { getAllEnabledRepos } from '../storage/repo-settings.js';

async function renderEnabledRepos(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const repos = await getAllEnabledRepos();

  // Remove existing repo list if any
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

renderEnabledRepos().catch(console.error);
