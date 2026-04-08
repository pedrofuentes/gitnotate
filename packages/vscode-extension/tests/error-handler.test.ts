import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  window,
  authentication,
  commands,
} from '../__mocks__/vscode';
import {
  showAuthError,
  showApiError,
  showConfigError,
  __resetErrorState,
} from '../src/error-handler';

describe('error-handler', () => {
  beforeEach(() => {
    __reset();
    __resetErrorState();
  });

  describe('showAuthError', () => {
    it('shows error message with "Sign in to GitHub" button', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'Gitnotate: GitHub authentication required to fetch PR comments.',
        'Sign in to GitHub'
      );
    });

    it('triggers authentication.getSession when user clicks "Sign in to GitHub"', async () => {
      window.showErrorMessage.mockResolvedValue('Sign in to GitHub');

      await showAuthError();

      expect(authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo'],
        { createIfNone: true }
      );
    });

    it('does not trigger authentication when user dismisses', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();

      expect(authentication.getSession).not.toHaveBeenCalled();
    });
  });

  describe('showApiError', () => {
    it('shows error message with "Retry" button', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showApiError('Rate limit exceeded');

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'Gitnotate: Rate limit exceeded',
        'Retry'
      );
    });

    it('executes refreshComments command when user clicks "Retry"', async () => {
      window.showErrorMessage.mockResolvedValue('Retry');

      await showApiError('Server error');

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'gitnotate.refreshComments'
      );
    });

    it('does not execute command when user dismisses', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showApiError('Server error');

      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('showConfigError', () => {
    it('shows error message with "Open Settings" button', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showConfigError('Invalid repository format');

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'Gitnotate: Invalid repository format',
        'Open Settings'
      );
    });

    it('opens settings filtered to gitnotate when user clicks "Open Settings"', async () => {
      window.showErrorMessage.mockResolvedValue('Open Settings');

      await showConfigError('Invalid repository format');

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'gitnotate'
      );
    });

    it('does not open settings when user dismisses', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showConfigError('Invalid repository format');

      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    it('suppresses duplicate error within 30s', async () => {
      vi.useFakeTimers();
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();
      await showAuthError();

      expect(window.showErrorMessage).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('allows same error after 30s', async () => {
      vi.useFakeTimers();
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();
      vi.advanceTimersByTime(30_001);
      await showAuthError();

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('does not suppress different error within 30s', async () => {
      vi.useFakeTimers();
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();
      await showApiError('Something failed');

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('__resetErrorState resets deduplication', async () => {
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();
      __resetErrorState();
      await showAuthError();

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
    });

    it('deduplicates key A even after key B fires (multi-key tracking)', async () => {
      vi.useFakeTimers();
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();        // key 'auth' → shown
      await showApiError('fail');   // key 'api:fail' → shown (different key)
      await showAuthError();        // key 'auth' within 30s → should be deduped

      expect(window.showErrorMessage).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('__resetErrorState clears all tracked error keys', async () => {
      vi.useFakeTimers();
      window.showErrorMessage.mockResolvedValue(undefined);

      await showAuthError();
      await showApiError('test');
      __resetErrorState();
      await showAuthError();
      await showApiError('test');

      expect(window.showErrorMessage).toHaveBeenCalledTimes(4);
      vi.useRealTimers();
    });
  });
});
