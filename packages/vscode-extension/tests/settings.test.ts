import { describe, it, expect, beforeEach } from 'vitest';
import {
  __setWorkspaceFolders,
  __setEnabledRepos,
  __getEnabledRepos,
  __reset,
} from '../__mocks__/vscode';
import {
  isWorkspaceEnabled,
  enableWorkspace,
  disableWorkspace,
} from '../src/settings';

describe('settings', () => {
  beforeEach(() => {
    __reset();
  });

  describe('isWorkspaceEnabled', () => {
    it('should return false when no workspace is open', () => {
      __setWorkspaceFolders(undefined);
      expect(isWorkspaceEnabled()).toBe(false);
    });

    it('should return false when workspace is not in enabled repos', () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos([]);
      expect(isWorkspaceEnabled()).toBe(false);
    });

    it('should return true when workspace is in enabled repos', () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos(['/my/project']);
      expect(isWorkspaceEnabled()).toBe(true);
    });

    it('should return false when a different workspace is enabled', () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos(['/other/project']);
      expect(isWorkspaceEnabled()).toBe(false);
    });
  });

  describe('enableWorkspace', () => {
    it('should do nothing when no workspace is open', async () => {
      __setWorkspaceFolders(undefined);
      await enableWorkspace();
      expect(__getEnabledRepos()).toEqual([]);
    });

    it('should add workspace path to enabled repos', async () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos([]);
      await enableWorkspace();
      expect(__getEnabledRepos()).toContain('/my/project');
    });

    it('should not duplicate workspace path if already enabled', async () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos(['/my/project']);
      await enableWorkspace();
      const repos = __getEnabledRepos();
      expect(repos.filter((r) => r === '/my/project')).toHaveLength(1);
    });
  });

  describe('disableWorkspace', () => {
    it('should do nothing when no workspace is open', async () => {
      __setWorkspaceFolders(undefined);
      __setEnabledRepos(['/some/path']);
      await disableWorkspace();
      expect(__getEnabledRepos()).toEqual(['/some/path']);
    });

    it('should remove workspace path from enabled repos', async () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos(['/my/project', '/other/project']);
      await disableWorkspace();
      const repos = __getEnabledRepos();
      expect(repos).not.toContain('/my/project');
      expect(repos).toContain('/other/project');
    });

    it('should handle removing a path that is not in the list', async () => {
      __setWorkspaceFolders([{ uri: { fsPath: '/my/project' } }]);
      __setEnabledRepos(['/other/project']);
      await disableWorkspace();
      expect(__getEnabledRepos()).toEqual(['/other/project']);
    });
  });
});
