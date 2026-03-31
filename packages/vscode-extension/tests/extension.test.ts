import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings module
vi.mock('../src/settings', () => ({
  enableWorkspace: vi.fn(),
  disableWorkspace: vi.fn(),
}));

// Mock new dependencies used by extension
vi.mock('../src/git-service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    isAvailable: () => false,
    getCurrentBranch: () => undefined,
    getRemoteUrl: () => undefined,
    getHeadCommit: () => undefined,
    parseGitHubOwnerRepo: () => null,
    isDefaultBranch: () => false,
  })),
}));

vi.mock('../src/auth', () => ({
  getGitHubToken: vi.fn().mockResolvedValue(undefined),
  ensureAuthenticated: vi.fn().mockResolvedValue('mock-token'),
}));

import { activate, deactivate } from '../src/extension';
import { commands, ExtensionMode } from '../__mocks__/vscode';

describe('extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all commands on activate', () => {
    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
      extensionMode: ExtensionMode.Test,
    };

    // The registerCommand mock returns undefined, which gets pushed to subscriptions
    activate(context as any);

    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.enable',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.disable',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.addComment',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledWith(
      'gitnotate.addFileComment',
      expect.any(Function)
    );
    expect(commands.registerCommand).toHaveBeenCalledTimes(4);
  });

  it('deactivate should be a no-op function', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
