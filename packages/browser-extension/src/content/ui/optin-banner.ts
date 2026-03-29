let currentBanner: HTMLElement | null = null;

const GN_ICON_SVG = '<svg class="gn-banner-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gnbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#18181B"/><stop offset="100%" stop-color="#27272A"/></linearGradient><linearGradient id="gnpin" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="#FAFAFA"/><stop offset="100%" stop-color="#E4E4E7"/></linearGradient></defs><rect width="128" height="128" rx="19" fill="url(#gnbg)"/><rect x="32" y="16.64" width="64" height="54.4" rx="6" fill="url(#gnpin)"/><polygon points="55.04,70.04 64,84.56 72.96,70.04" fill="url(#gnpin)"/><rect x="44.8" y="37.12" width="38.4" height="5.76" rx="2.88" fill="#71717A" opacity="0.35"/><rect x="48.64" y="50.88" width="30.72" height="5.76" rx="2.88" fill="#71717A" opacity="0.35"/><rect x="51.2" y="35.78" width="25.6" height="8.96" rx="3.13" fill="#10B981"/><path d="M52.48,100.8 L64,91.16 L75.52,100.8" stroke="#10B981" stroke-width="3.84" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function showOptInBanner(
  owner: string,
  repo: string,
  onEnable: () => void,
  onDismiss: () => void,
  onBlock: () => void,
): HTMLElement {
  hideOptInBanner();

  const banner = document.createElement('div');
  banner.className = 'gn-banner';

  // Icon
  const iconWrapper = document.createElement('div');
  iconWrapper.innerHTML = GN_ICON_SVG;

  // Body
  const body = document.createElement('div');
  body.className = 'gn-banner-body';

  const title = document.createElement('div');
  title.className = 'gn-banner-title';
  const titleText = document.createTextNode('Gitnotate ');
  const badge = document.createElement('span');
  badge.className = 'gn-badge';
  badge.textContent = 'New';
  title.appendChild(titleText);
  title.appendChild(badge);

  const desc = document.createElement('div');
  desc.className = 'gn-banner-desc';
  const descPrefix = document.createTextNode('Enable sub-line commenting for ');
  const repoStrong = document.createElement('strong');
  repoStrong.textContent = `${owner}/${repo}`;
  const descSuffix = document.createTextNode('?');
  desc.appendChild(descPrefix);
  desc.appendChild(repoStrong);
  desc.appendChild(descSuffix);

  body.appendChild(title);
  body.appendChild(desc);

  // Actions
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

  const icon = iconWrapper.firstElementChild;
  if (icon) banner.appendChild(icon);
  banner.appendChild(body);
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
