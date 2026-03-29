import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showOptInBanner,
  hideOptInBanner,
} from '../../../src/content/ui/optin-banner.js';

// @vitest-environment jsdom

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  hideOptInBanner();
});

describe('optin-banner', () => {
  it('should create banner element with correct text', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('myorg', 'myrepo', onEnable, onDismiss, onBlock);

    expect(banner).toBeInstanceOf(HTMLElement);
    expect(banner.textContent).toContain('myorg/myrepo');
    expect(banner.textContent).toContain('Enable Gitnotate');
    expect(document.body.contains(banner)).toBe(true);
  });

  it('should call onEnable when Enable button clicked', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('owner', 'repo', onEnable, onDismiss, onBlock);
    const enableBtn = banner.querySelector('.gn-banner-enable') as HTMLElement;

    expect(enableBtn).not.toBeNull();
    enableBtn.click();

    expect(onEnable).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should call onDismiss when Not now button clicked', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('owner', 'repo', onEnable, onDismiss, onBlock);
    const dismissBtn = banner.querySelector(
      '.gn-banner-dismiss'
    ) as HTMLElement;

    expect(dismissBtn).not.toBeNull();
    dismissBtn.click();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onEnable).not.toHaveBeenCalled();
  });

  it('should remove banner from DOM after choice', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('owner', 'repo', onEnable, onDismiss, onBlock);
    expect(document.body.contains(banner)).toBe(true);

    const enableBtn = banner.querySelector('.gn-banner-enable') as HTMLElement;
    enableBtn.click();

    expect(document.body.contains(banner)).toBe(false);
  });

  it('should remove banner from DOM when dismissed', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('owner', 'repo', onEnable, onDismiss, onBlock);
    expect(document.body.contains(banner)).toBe(true);

    const dismissBtn = banner.querySelector(
      '.gn-banner-dismiss'
    ) as HTMLElement;
    dismissBtn.click();

    expect(document.body.contains(banner)).toBe(false);
  });

  it('should use gn- prefixed CSS classes', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('owner', 'repo', onEnable, onDismiss, onBlock);

    // The banner itself should have a gn- prefixed class
    const allElements = banner.querySelectorAll('*');
    const bannerClasses = [
      ...banner.classList,
      ...[...allElements].flatMap((el) => [...el.classList]),
    ];

    // All classes should be gn- prefixed
    for (const cls of bannerClasses) {
      expect(cls).toMatch(/^gn-/);
    }
    // Should have at least the banner container, buttons
    expect(bannerClasses.length).toBeGreaterThanOrEqual(3);
  });

  it('should hide banner via hideOptInBanner', () => {
    const onEnable = vi.fn();
    const onDismiss = vi.fn();
    const onBlock = vi.fn();

    const banner = showOptInBanner('owner', 'repo', onEnable, onDismiss, onBlock);
    expect(document.body.contains(banner)).toBe(true);

    hideOptInBanner();
    expect(document.body.contains(banner)).toBe(false);
  });
});
