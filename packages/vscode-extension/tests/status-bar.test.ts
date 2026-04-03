import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getStatusBarItem, window, StatusBarAlignment } from '../__mocks__/vscode';
import { StatusBarManager } from '../src/status-bar';

describe('StatusBarManager', () => {
  let manager: StatusBarManager;

  beforeEach(() => {
    __reset();
    manager = new StatusBarManager();
  });

  describe('constructor', () => {
    it('creates StatusBarItem with Right alignment and priority 100', () => {
      expect(window.createStatusBarItem).toHaveBeenCalledWith(
        StatusBarAlignment.Right,
        100
      );
    });

    it('sets command to gitnotate.refreshComments', () => {
      const item = __getStatusBarItem();
      expect(item.command).toBe('gitnotate.refreshComments');
    });
  });

  describe('show', () => {
    it('sets text with PR number including git-pull-request icon', () => {
      manager.show(42);
      const item = __getStatusBarItem();
      expect(item.text).toBe('$(git-pull-request) Gitnotate: PR #42');
    });

    it('sets tooltip to refresh message', () => {
      manager.show(42);
      const item = __getStatusBarItem();
      expect(item.tooltip).toBe('Click to refresh Gitnotate comments');
    });

    it('calls item.show()', () => {
      manager.show(42);
      const item = __getStatusBarItem();
      expect(item.show).toHaveBeenCalled();
    });
  });

  describe('hide', () => {
    it('calls item.hide()', () => {
      manager.hide();
      const item = __getStatusBarItem();
      expect(item.hide).toHaveBeenCalled();
    });
  });

  describe('setLoading', () => {
    it('shows sync spinner text', () => {
      manager.setLoading();
      const item = __getStatusBarItem();
      expect(item.text).toBe('$(sync~spin) Gitnotate: Loading...');
    });

    it('calls item.show()', () => {
      manager.setLoading();
      const item = __getStatusBarItem();
      expect(item.show).toHaveBeenCalled();
    });
  });

  describe('setError', () => {
    it('shows error icon', () => {
      manager.setError('Something went wrong');
      const item = __getStatusBarItem();
      expect(item.text).toBe('$(error) Gitnotate: Error');
    });

    it('sets tooltip to error message', () => {
      manager.setError('Something went wrong');
      const item = __getStatusBarItem();
      expect(item.tooltip).toBe('Something went wrong');
    });

    it('calls item.show()', () => {
      manager.setError('Something went wrong');
      const item = __getStatusBarItem();
      expect(item.show).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('calls item.dispose()', () => {
      manager.dispose();
      const item = __getStatusBarItem();
      expect(item.dispose).toHaveBeenCalled();
    });
  });
});
