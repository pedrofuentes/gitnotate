let currentBanner: HTMLElement | null = null;

export function showOptInBanner(
  owner: string,
  repo: string,
  onEnable: () => void,
  onDismiss: () => void,
  onBlock: () => void,
): HTMLElement {
  // Remove any existing banner first
  hideOptInBanner();

  const banner = document.createElement('div');
  banner.className = 'gn-banner';

  const text = document.createElement('span');
  text.className = 'gn-banner-text';
  text.textContent = `Enable Gitnotate for ${owner}/${repo}? Add sub-line comments to PR reviews.`;

  const actions = document.createElement('div');
  actions.className = 'gn-banner-actions';

  const enableBtn = document.createElement('button');
  enableBtn.className = 'gn-banner-enable';
  enableBtn.textContent = 'Enable';
  enableBtn.addEventListener('click', () => {
    onEnable();
    removeBanner();
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'gn-banner-dismiss';
  dismissBtn.textContent = 'Not now';
  dismissBtn.addEventListener('click', () => {
    onDismiss();
    removeBanner();
  });

  const blockBtn = document.createElement('button');
  blockBtn.className = 'gn-banner-block';
  blockBtn.textContent = 'Never';
  blockBtn.addEventListener('click', () => {
    onBlock();
    removeBanner();
  });

  actions.appendChild(enableBtn);
  actions.appendChild(dismissBtn);
  actions.appendChild(blockBtn);
  banner.appendChild(text);
  banner.appendChild(actions);

  document.body.appendChild(banner);
  currentBanner = banner;

  return banner;

  function removeBanner() {
    if (banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
    if (currentBanner === banner) {
      currentBanner = null;
    }
  }
}

export function hideOptInBanner(): void {
  if (currentBanner && currentBanner.parentNode) {
    currentBanner.parentNode.removeChild(currentBanner);
    currentBanner = null;
  }
}
