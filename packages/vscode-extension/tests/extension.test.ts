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
import {
  commands,
  ExtensionMode,
  __getCommentControllers,
  __reset,
} from '../__mocks__/vscode';

describe('extension', () => {
  beforeEach(() => {
    __reset();
  });

  it('should register all commands on activate', () => {
    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
      extensionMode: ExtensionMode.Test,
    };

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
    expect(commands.registerCommand).toHaveBeenCalledTimes(3);
  });

  it('should create a CommentController on activation', () => {
    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
      extensionMode: ExtensionMode.Test,
    };

    activate(context as any);

    const controllers = __getCommentControllers();
    expect(controllers).toHaveLength(1);
    expect(controllers[0].id).toBe('gitnotate');
  });

  it('deactivate should dispose the CommentController', () => {
    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
      extensionMode: ExtensionMode.Test,
    };

    activate(context as any);

    const controllers = __getCommentControllers();
    deactivate();

    expect(controllers[0].dispose).toHaveBeenCalled();
  });
});
